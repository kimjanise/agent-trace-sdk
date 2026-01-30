"""
Voice Agent with Tools Example

A conversational voice agent that can use tools:
- Deepgram for Speech-to-Text (STT)
- OpenAI for LLM processing with function calling
- ElevenLabs for Text-to-Speech (TTS)

Requirements:
    pip install deepgram-sdk openai elevenlabs sounddevice soundfile

Environment variables:
    DEEPGRAM_API_KEY - Deepgram API key
    OPENAI_API_KEY - OpenAI API key
    ELEVENLABS_API_KEY - ElevenLabs API key

Usage:
    python examples/voice_agent_with_tools.py
"""

import os
import sys
import json
import tempfile
import subprocess

import sounddevice as sd
import soundfile as sf
import numpy as np
from deepgram import DeepgramClient
from openai import OpenAI
from elevenlabs import ElevenLabs

from agent_trace import agent, llm, stt, tts, tool


# Initialize clients
deepgram = DeepgramClient(api_key=os.environ.get("DEEPGRAM_API_KEY"))
openai_client = OpenAI()
elevenlabs = ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY"))


SYSTEM_PROMPT = """You are a helpful voice assistant with access to tools.
You can check the weather, get current time, set reminders, and do calculations.
Keep your responses concise and conversational since they will be spoken aloud.
When you use a tool, summarize the result naturally in your response."""

SAMPLE_RATE = 16000


# =============================================================================
# Tools
# =============================================================================

@tool
def get_weather(location: str) -> dict:
    """Get the current weather for a location."""
    weather_data = {
        "san francisco": {"temperature": 65, "conditions": "foggy", "humidity": 80},
        "new york": {"temperature": 45, "conditions": "cloudy", "humidity": 60},
        "los angeles": {"temperature": 75, "conditions": "sunny", "humidity": 40},
        "chicago": {"temperature": 35, "conditions": "windy", "humidity": 55},
        "tokyo": {"temperature": 55, "conditions": "clear", "humidity": 45},
        "london": {"temperature": 50, "conditions": "rainy", "humidity": 85},
    }
    data = weather_data.get(location.lower(), {"temperature": 70, "conditions": "unknown", "humidity": 50})
    return {"location": location, **data}


@tool
def get_current_time(timezone: str = "UTC") -> dict:
    """Get the current time in a specified timezone."""
    from datetime import datetime
    import time

    # Simplified timezone handling
    offsets = {
        "UTC": 0, "EST": -5, "PST": -8, "CST": -6, "MST": -7,
        "GMT": 0, "JST": 9, "CET": 1, "IST": 5.5,
    }
    offset = offsets.get(timezone.upper(), 0)

    utc_now = datetime.utcnow()
    hours = int(offset)
    minutes = int((offset - hours) * 60)

    from datetime import timedelta
    local_time = utc_now + timedelta(hours=hours, minutes=minutes)

    return {
        "timezone": timezone,
        "time": local_time.strftime("%I:%M %p"),
        "date": local_time.strftime("%A, %B %d, %Y"),
    }


@tool
def calculate(expression: str) -> dict:
    """Evaluate a mathematical expression. Supports +, -, *, /, **, sqrt, sin, cos, tan, log."""
    import math

    # Safe evaluation with limited namespace
    allowed_names = {
        "sqrt": math.sqrt, "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "log": math.log, "log10": math.log10, "pi": math.pi, "e": math.e,
        "abs": abs, "round": round, "pow": pow,
    }

    try:
        # Only allow safe characters
        for char in expression:
            if char not in "0123456789+-*/.() sincostaqrtlogepwabud":
                raise ValueError(f"Invalid character: {char}")

        result = eval(expression, {"__builtins__": {}}, allowed_names)
        return {"expression": expression, "result": result}
    except Exception as e:
        return {"expression": expression, "error": str(e)}


@tool
def set_reminder(message: str, minutes: int) -> dict:
    """Set a reminder for a specified number of minutes from now."""
    from datetime import datetime, timedelta

    reminder_time = datetime.now() + timedelta(minutes=minutes)
    return {
        "message": message,
        "reminder_time": reminder_time.strftime("%I:%M %p"),
        "status": "Reminder set successfully",
    }


@tool
def search_knowledge(query: str) -> dict:
    """Search for information about a topic."""
    # Simulated knowledge base
    knowledge = {
        "python": "Python is a high-level programming language known for its simplicity and readability.",
        "javascript": "JavaScript is a versatile programming language primarily used for web development.",
        "machine learning": "Machine learning is a subset of AI that enables systems to learn from data.",
        "weather": "Weather is the state of the atmosphere at a particular place and time.",
        "time": "Time is the indefinite continued progress of existence and events.",
    }

    query_lower = query.lower()
    for key, value in knowledge.items():
        if key in query_lower:
            return {"query": query, "result": value}

    return {"query": query, "result": "I don't have specific information about that topic."}


# Tool configuration
tools_config = [
    {"type": "function", "function": get_weather.schema},
    {"type": "function", "function": get_current_time.schema},
    {"type": "function", "function": calculate.schema},
    {"type": "function", "function": set_reminder.schema},
    {"type": "function", "function": search_knowledge.schema},
]

tool_map = {
    "get_weather": get_weather,
    "get_current_time": get_current_time,
    "calculate": calculate,
    "set_reminder": set_reminder,
    "search_knowledge": search_knowledge,
}


# =============================================================================
# Audio Functions
# =============================================================================

def record_audio(duration: float = None, silence_threshold: float = 0.02, silence_duration: float = 1.5) -> str:
    """Record audio from microphone until silence is detected after speech."""
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

    if sys.platform == "darwin":
        subprocess.run(["afplay", file_path], check=True)
    elif sys.platform == "win32":
        subprocess.run(["start", file_path], shell=True, check=True)
    else:
        subprocess.run(["aplay", file_path], check=True)


# =============================================================================
# STT / LLM / TTS Functions
# =============================================================================

@stt(provider="deepgram", model="nova-2")
def transcribe_audio(audio_path: str) -> str:
    """Transcribe audio file using Deepgram."""
    with open(audio_path, "rb") as audio_file:
        buffer_data = audio_file.read()

    response = deepgram.listen.v1.media.transcribe_file(
        request=buffer_data,
        model="nova-2",
        smart_format=True,
        language="en",
    )
    transcript = response.results.channels[0].alternatives[0].transcript
    return transcript


@llm(provider="openai", model="gpt-4o")
def call_llm(messages: list, tools: list = None):
    """Call OpenAI with optional tools."""
    kwargs = {"model": "gpt-4o", "messages": messages}
    if tools:
        kwargs["tools"] = tools
    return openai_client.chat.completions.create(**kwargs)


@tts(provider="elevenlabs", voice="rachel")
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


# =============================================================================
# Agent Logic
# =============================================================================

def process_with_tools(user_message: str, conversation_history: list) -> str:
    """Process user message, handle tool calls, and return final response."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    max_tool_rounds = 5

    for _ in range(max_tool_rounds):
        response = call_llm(messages=messages, tools=tools_config)
        message = response.choices[0].message

        # If no tool calls, return the content
        if not message.tool_calls:
            return message.content

        # Process tool calls - convert message to dict for serialization
        messages.append({
            "role": "assistant",
            "content": message.content,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                }
                for tc in message.tool_calls
            ]
        })

        print("🔧 Using tools...")
        for tool_call in message.tool_calls:
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)

            print(f"   → {function_name}({arguments})")

            if function_name in tool_map:
                try:
                    result = tool_map[function_name](**arguments)
                except Exception as e:
                    result = {"error": str(e)}
            else:
                result = {"error": f"Unknown function: {function_name}"}

            messages.append({
                "role": "tool",
                "name": function_name,
                "content": json.dumps(result),
                "tool_call_id": tool_call.id
            })

    # Final response after tool rounds
    final_response = call_llm(messages=messages)
    return final_response.choices[0].message.content


@agent(name="advanced_support_voice_agent")
def interactive_session():
    """Run an interactive voice conversation loop with tool support."""
    print("=" * 60)
    print("🎙️  Voice Agent with Tools - Interactive Mode")
    print("=" * 60)
    print("I can help you with:")
    print("  • Weather information")
    print("  • Current time in different timezones")
    print("  • Math calculations")
    print("  • Setting reminders")
    print("  • Searching for information")
    print("\nSpeak into your microphone. Press Ctrl+C to exit.\n")

    conversation_history = []
    turns = []

    try:
        while True:
            # Record from microphone
            audio_path = record_audio()

            try:
                # Transcribe
                print("📝 Transcribing...")
                user_message = transcribe_audio(audio_path)
                print(f"You: {user_message}")

                if not user_message.strip():
                    print("(No speech detected, try again)")
                    continue

                # Process with potential tool calls
                print("🤔 Thinking...")
                response = process_with_tools(user_message, conversation_history)
                print(f"Assistant: {response}")

                # Update history
                conversation_history.append({"role": "user", "content": user_message})
                conversation_history.append({"role": "assistant", "content": response})
                turns.append({"user": user_message, "assistant": response})

                # Keep history manageable
                if len(conversation_history) > 20:
                    conversation_history = conversation_history[-20:]

                # Synthesize and play
                output_path = "response.mp3"
                synthesize_speech(response, output_path)
                play_audio(output_path)

            finally:
                if os.path.exists(audio_path):
                    os.unlink(audio_path)

            print()

    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
        return turns


def main():
    interactive_session()


if __name__ == "__main__":
    main()
