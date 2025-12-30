from functools import wraps
from typing import Any, Callable, Optional, Union
import asyncio
import inspect
from .models import Trace
from .context import TraceContext, AsyncTraceContext, get_current_trace

class AgentWrapper:
    def __init__(self, func: Callable, name: str = None):
        self._func = func
        self._name = name or func.__name__
        self._is_async = asyncio.iscoroutinefunction(func)
        
        self.__name__ = self._name
        self.__doc__ = func.__doc__
        self.__wrapped__ = func
        self.__signature__ = inspect.signature(func)
        
        self._last_trace: Optional[Trace] = None
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def last_trace(self) -> Optional[Trace]:
        """The trace from the last invocation."""
        return self._last_trace
    
    def __call__(self, *args, **kwargs) -> Any:
        if self._is_async:
            return self._call_async(*args, **kwargs)
        return self._call_sync(*args, **kwargs)
    
    def _capture_input(self, args: tuple, kwargs: dict) -> Any:
        if args and not kwargs:
            return args[0] if len(args) == 1 else args
        elif kwargs and not args:
            return kwargs
        return {"args": args, "kwargs": kwargs}
    
    def _call_sync(self, *args, **kwargs) -> Any:
        trace = Trace(agent_name=self._name)
        trace.input = self._capture_input(args, kwargs)
        self._last_trace = trace
        
        with TraceContext(trace):
            try:
                result = self._func(*args, **kwargs)
                trace.complete(output=result)
                return result
            except Exception as e:
                trace.complete(error=str(e))
                raise
    
    async def _call_async(self, *args, **kwargs) -> Any:
        trace = Trace(agent_name=self._name)
        trace.input = self._capture_input(args, kwargs)
        self._last_trace = trace
        
        async with AsyncTraceContext(trace):
            try:
                result = await self._func(*args, **kwargs)
                trace.complete(output=result)
                return result
            except Exception as e:
                trace.complete(error=str(e))
                raise

def agent(func: Callable = None, *, name: str = None) -> Union[AgentWrapper, Callable]:
    def decorator(f: Callable) -> AgentWrapper:
        return AgentWrapper(f, name=name)
    
    if func is not None:
        return decorator(func)
    return decorator

def get_trace() -> Optional[Trace]:
    return get_current_trace()