"""
Agent Trace SDK - Trace AI agent executions.

Usage:
    from agent_trace import tool, agent, traced_client
    
    @tool
    def my_tool(x: str) -> str:
        return x.upper()
    
    client = traced_client(OpenAI())
    
    @agent
    def my_agent(input: str) -> str:
        response = client.chat.completions.create(...)
        return response.content
"""

from .models import Trace, LLMCall, ToolExecution, TraceStatus
from .tool import tool, ToolWrapper
from .clients.openai_client import traced_client
from .agent import agent, AgentWrapper, get_trace
from .context import get_current_trace, TraceContext
from .storage import TraceStore, InMemoryTraceStore, FileTraceStore

__version__ = "0.1.0"

__all__ = [
    "tool", "agent", "traced_client", "get_trace",
    "Trace", "LLMCall", "ToolExecution", "TraceStatus",
    "ToolWrapper", "AgentWrapper",
    "get_current_trace", "TraceContext",
    "TraceStore", "InMemoryTraceStore", "FileTraceStore",
]