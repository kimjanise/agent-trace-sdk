from abc import ABC, abstractmethod
from typing import List, Optional
from pathlib import Path
import json
import os
from .models import Trace, LLMCall, ToolExecution, TokenUsage, ToolExecutionStatus, TraceStatus


class TraceStore(ABC):    
    @abstractmethod
    def save(self, trace: Trace) -> None:
        pass
    
    @abstractmethod
    def get(self, trace_id: str) -> Optional[Trace]:
        pass
    
    @abstractmethod
    def list(self, limit: int = 100) -> List[Trace]:
        pass


class InMemoryTraceStore(TraceStore):
    def __init__(self):
        self._traces = {}
    
    def save(self, trace: Trace) -> None:
        self._traces[trace.trace_id] = trace
    
    def get(self, trace_id: str) -> Optional[Trace]:
        return self._traces.get(trace_id)
    
    def list(self, limit: int = 100) -> List[Trace]:
        traces = list(self._traces.values())
        traces.sort(key=lambda t: t.started_at, reverse=True)
        return traces[:limit]
    
    def clear(self) -> None:
        self._traces.clear()


class FileTraceStore(TraceStore):
    def __init__(self, base_path: str = "./traces"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def save(self, trace: Trace) -> None:
        path = self.base_path / f"{trace.trace_id}.json"
        with open(path, "w") as f:
            json.dump(trace.to_dict(), f, indent=2, default=str)
    
    def get(self, trace_id: str) -> Optional[Trace]:
        path = self.base_path / f"{trace_id}.json"
        if not path.exists():
            return None
        with open(path) as f:
            return json.load(f)
    
    def list(self, limit: int = 100) -> List[dict]:
        traces = []
        for path in self.base_path.glob("*.json"):
            with open(path) as f:
                traces.append(json.load(f))
        traces.sort(key=lambda t: t.get("started_at", ""), reverse=True)
        return traces[:limit]


class SupabaseTraceStore(TraceStore):
    """Store traces in Supabase with normalized tables for UI tree-view support."""

    def __init__(self, url: str = None, key: str = None):
        """
        Initialize Supabase client.

        Args:
            url: Supabase project URL. Falls back to SUPABASE_URL env var.
            key: Supabase anon/service key. Falls back to SUPABASE_KEY env var.
        """
        try:
            from supabase import create_client, Client
        except ImportError:
            raise ImportError("supabase package required. Install with: pip install supabase")

        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = key or os.environ.get("SUPABASE_KEY")

        if not self.url or not self.key:
            raise ValueError("Supabase URL and key required. Provide via arguments or SUPABASE_URL/SUPABASE_KEY env vars.")

        self.client: Client = create_client(self.url, self.key)

    def save(self, trace: Trace) -> None:
        """Save trace with all LLM calls and tool executions."""
        # Insert trace
        trace_data = {
            "trace_id": trace.trace_id,
            "agent_name": trace.agent_name,
            "input": str(trace.input) if trace.input is not None else None,
            "output": str(trace.output) if trace.output is not None else None,
            "error": trace.error,
            "started_at": trace.started_at.isoformat(),
            "ended_at": trace.ended_at.isoformat() if trace.ended_at else None,
            "status": trace.status.value,
            "metadata": trace.metadata,
            "total_tokens": trace.total_tokens,
            "duration_ms": trace.duration_ms,
        }
        self.client.table("traces").upsert(trace_data).execute()

        # Insert LLM calls
        for llm_call in trace.llm_calls:
            call_data = {
                "call_id": llm_call.call_id,
                "trace_id": trace.trace_id,
                "provider": llm_call.provider,
                "model": llm_call.model,
                "request_messages": llm_call.request_messages,
                "request_tools": llm_call.request_tools,
                "request_system_prompt": llm_call.request_system_prompt,
                "request_temperature": llm_call.request_temperature,
                "request_max_tokens": llm_call.request_max_tokens,
                "response_content": llm_call.response_content,
                "response_tool_calls": [
                    {"tool_call_id": tc.tool_call_id, "tool_name": tc.tool_name, "arguments_raw": tc.arguments_raw}
                    for tc in llm_call.response_tool_calls
                ] if llm_call.response_tool_calls else [],
                "response_finish_reason": llm_call.response_finish_reason,
                "prompt_tokens": llm_call.usage.prompt_tokens,
                "completion_tokens": llm_call.usage.completion_tokens,
                "total_tokens": llm_call.usage.total_tokens,
                "started_at": llm_call.started_at.isoformat(),
                "ended_at": llm_call.ended_at.isoformat() if llm_call.ended_at else None,
                "duration_ms": llm_call.duration_ms,
                "streaming": llm_call.streaming,
            }
            self.client.table("llm_calls").upsert(call_data).execute()

        # Insert tool executions
        for tool_exec in trace.tool_executions:
            exec_data = {
                "execution_id": tool_exec.execution_id,
                "trace_id": trace.trace_id,
                "llm_call_id": tool_exec.llm_call_id,
                "tool_name": tool_exec.tool_name,
                "arguments": tool_exec.arguments,
                "result": str(tool_exec.result) if tool_exec.result else None,
                "error": tool_exec.error,
                "started_at": tool_exec.started_at.isoformat(),
                "ended_at": tool_exec.ended_at.isoformat() if tool_exec.ended_at else None,
                "duration_ms": tool_exec.duration_ms,
                "status": tool_exec.status.value,
            }
            self.client.table("tool_executions").upsert(exec_data).execute()

    def get(self, trace_id: str) -> Optional[Trace]:
        """Fetch trace with all related LLM calls and tool executions."""
        # Fetch trace
        result = self.client.table("traces").select("*").eq("trace_id", trace_id).execute()
        if not result.data:
            return None

        trace_data = result.data[0]

        # Fetch LLM calls
        llm_result = self.client.table("llm_calls").select("*").eq("trace_id", trace_id).execute()

        # Fetch tool executions
        tool_result = self.client.table("tool_executions").select("*").eq("trace_id", trace_id).execute()

        # Reconstruct Trace object
        from datetime import datetime

        trace = Trace(
            trace_id=trace_data["trace_id"],
            agent_name=trace_data["agent_name"],
            input=trace_data["input"],
            output=trace_data["output"],
            error=trace_data["error"],
            started_at=datetime.fromisoformat(trace_data["started_at"].replace("Z", "+00:00")),
            ended_at=datetime.fromisoformat(trace_data["ended_at"].replace("Z", "+00:00")) if trace_data["ended_at"] else None,
            status=TraceStatus(trace_data["status"]),
            metadata=trace_data["metadata"] or {},
        )

        # Reconstruct LLM calls
        for call_data in llm_result.data:
            llm_call = LLMCall(
                call_id=call_data["call_id"],
                provider=call_data["provider"],
                model=call_data["model"],
                request_messages=call_data["request_messages"] or [],
                request_tools=call_data["request_tools"] or [],
                request_system_prompt=call_data["request_system_prompt"],
                request_temperature=call_data["request_temperature"],
                request_max_tokens=call_data["request_max_tokens"],
                response_content=call_data["response_content"],
                response_tool_calls=call_data["response_tool_calls"] or [],
                response_finish_reason=call_data["response_finish_reason"],
                usage=TokenUsage(
                    prompt_tokens=call_data["prompt_tokens"] or 0,
                    completion_tokens=call_data["completion_tokens"] or 0,
                    total_tokens=call_data["total_tokens"] or 0,
                ),
                started_at=datetime.fromisoformat(call_data["started_at"].replace("Z", "+00:00")),
                ended_at=datetime.fromisoformat(call_data["ended_at"].replace("Z", "+00:00")) if call_data["ended_at"] else None,
                streaming=call_data["streaming"] or False,
            )
            trace.llm_calls.append(llm_call)

        # Reconstruct tool executions
        for exec_data in tool_result.data:
            tool_exec = ToolExecution(
                execution_id=exec_data["execution_id"],
                tool_name=exec_data["tool_name"],
                arguments=exec_data["arguments"] or {},
                result=exec_data["result"],
                error=exec_data["error"],
                started_at=datetime.fromisoformat(exec_data["started_at"].replace("Z", "+00:00")),
                ended_at=datetime.fromisoformat(exec_data["ended_at"].replace("Z", "+00:00")) if exec_data["ended_at"] else None,
                status=ToolExecutionStatus(exec_data["status"]),
                llm_call_id=exec_data["llm_call_id"],
            )
            trace.tool_executions.append(tool_exec)

        return trace

    def list(self, limit: int = 100) -> List[dict]:
        """List recent traces (metadata only, without nested calls)."""
        result = self.client.table("traces").select("*").order("started_at", desc=True).limit(limit).execute()
        return result.data

    def get_llm_calls(self, trace_id: str) -> List[dict]:
        """Fetch LLM calls for a trace (for lazy loading in UI)."""
        result = self.client.table("llm_calls").select("*").eq("trace_id", trace_id).order("started_at").execute()
        return result.data

    def get_tool_executions(self, trace_id: str, llm_call_id: str = None) -> List[dict]:
        """Fetch tool executions, optionally filtered by LLM call."""
        query = self.client.table("tool_executions").select("*").eq("trace_id", trace_id)
        if llm_call_id:
            query = query.eq("llm_call_id", llm_call_id)
        result = query.order("started_at").execute()
        return result.data