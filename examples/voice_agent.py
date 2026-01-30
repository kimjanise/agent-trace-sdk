"""
Voice Agent Example

A conversational voice agent using:
- Deepgram for Speech-to-Text (STT)
- OpenAI for LLM processing
- ElevenLabs for Text-to-Speech (TTS)

Requirements:
    pip install deepgram-sdk openai elevenlabs sounddevice soundfile

Environment variables:
    DEEPGRAM_API_KEY - Deepgram API key
    OPENAI_API_KEY - OpenAI API key
    ELEVENLABS_API_KEY - ElevenLabs API key

Usage:
    python examples/voice_agent.py              # Interactive mode with microphone
    python examples/voice_agent.py <audio.wav>  # Process audio file
    python examples/voice_agent.py --text "Hi"  # Process text directly
"""

import os
import sys
import argparse
import tempfile
import subprocess
from pathlib import Path

import sounddevice as sd
import soundfile as sf
import numpy as np
from deepgram import DeepgramClient
from openai import OpenAI
from elevenlabs import ElevenLabs

from agent_trace import agent, llm, stt, tts


# Initialize clients
deepgram = DeepgramClient(api_key=os.environ.get("DEEPGRAM_API_KEY"))
openai_client = OpenAI()
elevenlabs = ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY"))


SYSTEM_PROMPT = """You are a helpful voice assistant. Keep your responses concise and conversational,
as they will be spoken aloud. Aim for 1-3 sentences unless the user asks for more detail."""

SAMPLE_RATE = 16000  # 16kHz for speech recognition


def record_audio(duration: float = None, silence_threshold: float = 0.02, silence_duration: float = 1.5) -> str:
    """
    Record audio from microphone until silence is detected after speech.

    Args:
        duration: Max recording duration in seconds (None for auto-stop on silence)
        silence_threshold: RMS threshold below which is considered silence
        silence_duration: Seconds of silence before stopping

    Returns:
        Path to temporary WAV file
    """
    print("\n🎤 Listening... (speak now, pause to finish)")

    chunks = []
    silent_chunks = 0
    speech_started = False
    chunks_per_second = 10
    chunk_size = SAMPLE_RATE // chunks_per_second
    max_silent_chunks = int(silence_duration * chunks_per_second)
    max_chunks = int((duration or 30) * chunks_per_second)

    def callback(indata, frames, time, status):
        chunks.append(indata.copy())

    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype=np.float32,
                        blocksize=chunk_size, callback=callback):
        chunk_count = 0
        while chunk_count < max_chunks:
            sd.sleep(int(1000 / chunks_per_second))
            chunk_count += 1

            if len(chunks) > 0:
                rms = np.sqrt(np.mean(chunks[-1] ** 2))

                if rms >= silence_threshold:
                    # Speech detected
                    if not speech_started:
                        print("   (recording...)")
                        speech_started = True
                    silent_chunks = 0
                else:
                    # Silence detected
                    if speech_started:
                        silent_chunks += 1
                        if silent_chunks >= max_silent_chunks:
                            break

    print("✓ Recording complete")

    if not chunks:
        # Return empty file if no audio captured
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        sf.write(temp_file.name, np.array([]), SAMPLE_RATE)
        return temp_file.name

    audio_data = np.concatenate(chunks, axis=0)
    temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    sf.write(temp_file.name, audio_data, SAMPLE_RATE)

    return temp_file.name


def play_audio(file_path: str):
    """Play audio file using system default player."""
    print("🔊 Playing response...")

    if sys.platform == "darwin":  # macOS
        subprocess.run(["afplay", file_path], check=True)
    elif sys.platform == "win32":  # Windows
        subprocess.run(["start", file_path], shell=True, check=True)
    else:  # Linux
        subprocess.run(["aplay", file_path], check=True)

@stt(provider="deepgram", model="nova-2")
def transcribe_audio(audio_path: str):
    """Transcribe audio file using Deepgram. Returns full response for tracing."""
    with open(audio_path, "rb") as audio_file:
        buffer_data = audio_file.read()

    response = deepgram.listen.v1.media.transcribe_file(
        request=buffer_data,
        model="nova-2",
        smart_format=True,
        language="en",
    )
    # Return full response - decorator will extract transcript and duration
    return response

@llm(provider="openai", model="gpt-4o")
def generate_response(user_message: str, conversation_history: list):
    """Generate a response using OpenAI."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=0.7,
        max_tokens=150,
    )

    return response  # Return full response so SDK can extract tokens

@tts(provider="elevenlabs", model="eleven_multilingual_v2", voice="rachel")
def synthesize_speech(text: str, output_path: str = None) -> bytes:
    """Convert text to speech using ElevenLabs."""
    audio_generator = elevenlabs.text_to_speech.convert(
        text=text,
        voice_id="JBFqnCBsd6RMkjVDRZzb",  # "George" voice
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )

    # Collect audio bytes from generator
    audio_bytes = b"".join(audio_generator)

    if output_path:
        with open(output_path, "wb") as f:
            f.write(audio_bytes)
        print(f"Audio saved to: {output_path}")

    return audio_bytes

@agent(name="voice_agent")
def voice_agent(audio_path: str = None, text_input: str = None) -> dict:
    """
    Process a voice or text input and generate a spoken response.

    Args:
        audio_path: Path to audio file for STT processing
        text_input: Direct text input (skips STT)

    Returns:
        dict with transcript, response, and audio_output_path
    """
    conversation_history = []

    # Step 1: Get user input (either from audio or direct text)
    if audio_path:
        print(f"Transcribing: {audio_path}")
        stt_response = transcribe_audio(audio_path)
        user_message = stt_response.results.channels[0].alternatives[0].transcript
        print(f"Transcript: {user_message}")
    elif text_input:
        user_message = text_input
        print(f"Input: {user_message}")
    else:
        raise ValueError("Either audio_path or text_input must be provided")

    # Step 2: Generate LLM response
    print("Generating response...")
    response = generate_response(user_message, conversation_history)
    assistant_response = response.choices[0].message.content
    print(f"Response: {assistant_response}")

    # Step 3: Synthesize speech
    print("Synthesizing speech...")
    output_path = "output_response.mp3"
    synthesize_speech(assistant_response, output_path)

    return {
        "transcript": user_message,
        "response": assistant_response,
        "audio_output_path": output_path,
    }


@agent(name="voice_agent_session")
def interactive_session():
    """Run an interactive voice conversation loop (entire session is one trace)."""
    print("=" * 50)
    print("🎙️  Voice Agent - Interactive Mode")
    print("=" * 50)
    print("Speak into your microphone. The agent will respond.")
    print("Press Ctrl+C to exit.\n")

    conversation_history = []
    turns = []

    try:
        while True:
            # Record from microphone
            audio_path = record_audio()

            try:
                print("Transcribing...")
                stt_response = transcribe_audio(audio_path)
                user_message = stt_response.results.channels[0].alternatives[0].transcript
                print(f"You: {user_message}")

                if not user_message.strip():
                    print("(No speech detected, try again)")
                    continue

                # Generate response
                print("Thinking...")
                response = generate_response(user_message, conversation_history)
                response_text = response.choices[0].message.content
                print(f"Assistant: {response_text}")

                # Update history
                conversation_history.append({"role": "user", "content": user_message})
                conversation_history.append({"role": "assistant", "content": response_text})
                turns.append({"user": user_message, "assistant": response_text})

                # Keep history manageable (last 10 turns)
                if len(conversation_history) > 20:
                    conversation_history = conversation_history[-20:]

                # Synthesize and play
                output_path = "response.mp3"
                synthesize_speech(response_text, output_path)
                play_audio(output_path)

            finally:
                # Clean up temp audio file
                if os.path.exists(audio_path):
                    os.unlink(audio_path)

            print()  # Blank line before next turn

    except KeyboardInterrupt:
        print("\n\nGoodbye!")
        return turns  # Return conversation history as output


def main():
    parser = argparse.ArgumentParser(description="Voice Agent Example")
    parser.add_argument("audio_file", nargs="?", help="Path to audio file to process")
    parser.add_argument("--text", "-t", help="Direct text input (skips STT)")
    args = parser.parse_args()

    # Interactive mode if no arguments
    if not args.audio_file and not args.text:
        interactive_session()
        return

    if args.audio_file and not Path(args.audio_file).exists():
        print(f"Error: Audio file not found: {args.audio_file}")
        sys.exit(1)

    result = voice_agent(audio_path=args.audio_file, text_input=args.text)

    print("\n" + "=" * 50)
    print("Voice Agent Result:")
    print(f"  Input: {result['transcript']}")
    print(f"  Response: {result['response']}")
    print(f"  Audio: {result['audio_output_path']}")
    print("=" * 50)


if __name__ == "__main__":
    main()
