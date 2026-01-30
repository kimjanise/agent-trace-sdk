"""
Agent Trace SDK - Trace AI agent executions.

Usage:
    from agent_trace import agent, tool, llm, stt, tts

    @llm(provider="openai", model="gpt-4o")
    def call_llm(messages: list) -> str:
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        return response.choices[0].message.content

    @stt(provider="openai", model="whisper-1")
    def transcribe(audio_path: str) -> str:
        with open(audio_path, "rb") as f:
            return openai.audio.transcriptions.create(model="whisper-1", file=f).text

    @tts(provider="openai", model="tts-1", voice="alloy")
    def speak(text: str) -> bytes:
        return openai.audio.speech.create(model="tts-1", input=text, voice="alloy").content

    @tool
    def search(query: str) -> list:
        return db.search(query)

    @agent
    def my_agent(query: str) -> str:
        result = call_llm([{"role": "user", "content": query}])
        return result
"""

from .models import Trace, LLMCall, ToolExecution, TraceStatus, STTCall, TTSCall
from .tool import tool, ToolWrapper
from .llm import llm, LLMWrapper
from .stt import stt, STTWrapper
from .tts import tts, TTSWrapper
from .agent import agent, AgentWrapper, get_trace
from .context import get_current_trace, TraceContext
from .storage import TraceStore, InMemoryTraceStore, FileTraceStore, SupabaseTraceStore, ThreadedSupabaseTraceStore
from .config import configure

__version__ = "0.1.0"

__all__ = [
    "agent", "tool", "get_trace", "configure",
    "llm", "stt", "tts",
    "Trace", "LLMCall", "ToolExecution", "TraceStatus",
    "STTCall", "TTSCall",
    "AgentWrapper", "ToolWrapper", "LLMWrapper", "STTWrapper", "TTSWrapper",
    "get_current_trace", "TraceContext",
    "TraceStore", "InMemoryTraceStore", "FileTraceStore", "SupabaseTraceStore", "ThreadedSupabaseTraceStore",
]

# Auto-configure from environment variables on import
# Uses lazy initialization to avoid httpx conflicts with other SDKs (Deepgram, ElevenLabs)
configure()