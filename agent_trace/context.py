from contextvars import ContextVar
from typing import Optional
from .models import Trace, LLMCall, ToolExecution

_current_trace: ContextVar[Optional[Trace]] = ContextVar("current_trace", default=None)
_current_llm_call: ContextVar[Optional[LLMCall]] = ContextVar("current_llm_call", default=None)

def get_current_trace() -> Optional[Trace]:
    return _current_trace.get()

def get_current_llm_call() -> Optional[LLMCall]:
    return _current_llm_call.get()

class TraceContext:
    def _init_(self, trace: Trace):
        self.trace = trace

    def _enter_(self) -> Trace:
        self._token = _current_trace_set(self.trace)
        return self.trace
    
    def _exit_(self, exc_type, exc_value, traceback) -> None:
        _current_trace_reset(self._token)
        if exc_type is not None:
            self.trace.complete(error=str(exc_val))
        return False

class LLMCallContext:
    def _init_(self, llm_call: LLMCall):
        self.llm_call = llm_call

    def _enter_(self) -> LLMCall:
        self._token = _current_llm_call_set(self.llm_call)
        return self.llm_call
    
    def _exit_(self, exc_type, exc_value, traceback) -> None:
        _current_llm_call_reset(self._token)
        if exc_type is not None:

def record_llm_call(llm_call: LLMCall) -> None:
    trace = get_current_trace()
    if trace is not None:
        trace.add_llm_call(llm_call)

def record_tool_execution(execution : ToolExecution) -> None:
    trace = get_current_trace()
    if trace is not None:
        llm = get_current_llm_call
        if llm is not None:
            execution.llm_call_id = llm.call_id
        trace.add_tool_execution(execution)

class AsyncTraceContext:
    def __init__(self, trace: Trace):
        self.trace = trace
        self._token = None
    
    async def __aenter__(self) -> Trace:
        self._token = _current_trace.set(self.trace)
        return self.trace
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        _current_trace.reset(self._token)
        if exc_type is not None:
            self.trace.complete(error=str(exc_val))
        return False



