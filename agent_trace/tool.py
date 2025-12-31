from functools import wraps
from typing import Any, Callable, Optional, Union, get_type_hints, get_origin, get_args
import inspect
import asyncio
from .models import ToolExecution
from .context import record_tool_execution


PYTHON_TO_JSON_TYPE = {
    str: "string",
    int: "integer",
    float: "number",
    bool: "boolean",
    list: "array",
    dict: "object",
}


def python_type_to_json_schema(python_type: Any) -> dict:
    if python_type in PYTHON_TO_JSON_TYPE:
        return {"type": PYTHON_TO_JSON_TYPE[python_type]}
    
    origin = get_origin(python_type)
    args = get_args(python_type)
    
    if origin is list:
        schema = {"type": "array"}
        if args:
            schema["items"] = python_type_to_json_schema(args[0])
        return schema
    
    if origin is dict:
        return {"type": "object"}
    
    if origin is Union:
        non_none = [a for a in args if a is not type(None)]
        if len(non_none) == 1:
            return python_type_to_json_schema(non_none[0])
    
    return {"type": "string"}


def generate_tool_schema(func: Callable) -> dict:
    sig = inspect.signature(func)
    try:
        hints = get_type_hints(func)
    except Exception:
        hints = {}
    
    properties = {}
    required = []
    
    for name, param in sig.parameters.items():
        if param.kind in (param.VAR_POSITIONAL, param.VAR_KEYWORD):
            continue
        
        if name in hints:
            prop_schema = python_type_to_json_schema(hints[name])
        else:
            prop_schema = {"type": "string"}
        
        properties[name] = prop_schema
        
        if param.default is param.empty:
            required.append(name)
    
    return {
        "name": func.__name__,
        "description": func.__doc__ or "",
        "parameters": {
            "type": "object",
            "properties": properties,
            "required": required if required else None,
        }
    }


class ToolWrapper:
    def __init__(self, func: Callable, name: str = None, description: str = None):
        self._func = func
        self._name = name or func.__name__
        self._description = description or func.__doc__ or ""
        self._is_async = asyncio.iscoroutinefunction(func)
        
        self._schema = generate_tool_schema(func)
        if name:
            self._schema["name"] = name
        if description:
            self._schema["description"] = description
        
        self.__name__ = self._name
        self.__doc__ = self._description
        self.__wrapped__ = func
        self.__signature__ = inspect.signature(func)
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def description(self) -> str:
        return self._description
    
    @property
    def schema(self) -> dict:
        return self._schema
    
    def _create_execution(self, args: tuple, kwargs: dict) -> ToolExecution:
        try:
            bound = self.__signature__.bind(*args, **kwargs)
            bound.apply_defaults()
            arguments = dict(bound.arguments)
        except TypeError:
            arguments = {"args": args, "kwargs": kwargs}
        
        return ToolExecution(tool_name=self._name, arguments=arguments)
    
    def __call__(self, *args, **kwargs) -> Any:
        if self._is_async:
            return self._call_async(*args, **kwargs)
        return self._call_sync(*args, **kwargs)
    
    def _call_sync(self, *args, **kwargs) -> Any:
        execution = self._create_execution(args, kwargs)
        try:
            result = self._func(*args, **kwargs)
            execution.complete(result=result)
            return result
        except Exception as e:
            execution.complete(error=str(e))
            raise
        finally:
            record_tool_execution(execution)
    
    async def _call_async(self, *args, **kwargs) -> Any:
        execution = self._create_execution(args, kwargs)
        try:
            result = await self._func(*args, **kwargs)
            execution.complete(result=result)
            return result
        except Exception as e:
            execution.complete(error=str(e))
            raise
        finally:
            record_tool_execution(execution)


def tool(func: Callable = None, *, name: str = None, description: str = None) -> Union[ToolWrapper, Callable]:
    def decorator(f: Callable) -> ToolWrapper:
        return ToolWrapper(f, name=name, description=description)
    
    if func is not None:
        return decorator(func)
    return decorator