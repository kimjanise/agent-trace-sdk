from typing import Any, Callable, Optional, Union
import asyncio
import inspect
from .models import LLMCall, TokenUsage, ToolCallRequest
from .context import record_llm_call, LLMCallContext, set_last_llm_call_with_tools


class LLMWrapper:
    def __init__(
        self,
        func: Callable,
        provider: str = "unknown",
        model: str = "unknown",
    ):
        self._func = func
        self._provider = provider
        self._model = model
        self._is_async = asyncio.iscoroutinefunction(func)

        self.__name__ = func.__name__
        self.__doc__ = func.__doc__
        self.__wrapped__ = func
        self.__signature__ = inspect.signature(func)

    @property
    def provider(self) -> str:
        return self._provider

    @property
    def model(self) -> str:
        return self._model

    def _extract_messages(self, args: tuple, kwargs: dict) -> list:
        """Try to extract messages from arguments."""
        for key in ["messages", "prompt", "input"]:
            if key in kwargs:
                val = kwargs[key]
                if isinstance(val, list):
                    return val
                return [{"role": "user", "content": str(val)}]

        for arg in args:
            if isinstance(arg, list):
                return arg
            if isinstance(arg, str):
                return [{"role": "user", "content": arg}]

        return []

    def _extract_response_content(self, result: Any) -> Optional[str]:
        """Try to extract response content from result."""
        if isinstance(result, str):
            return result
        if hasattr(result, "content"):
            content = result.content
            if isinstance(content, str):
                return content
            if isinstance(content, list) and len(content) > 0:
                first = content[0]
                if hasattr(first, "text"):
                    return first.text
                return str(first)
        if hasattr(result, "text"):
            return result.text
        if hasattr(result, "choices") and result.choices:
            choice = result.choices[0]
            if hasattr(choice, "message") and hasattr(choice.message, "content"):
                return choice.message.content
            if hasattr(choice, "text"):
                return choice.text
        return str(result) if result else None

    def _extract_usage(self, result: Any) -> TokenUsage:
        """Try to extract token usage from result."""
        usage = TokenUsage()
        if hasattr(result, "usage") and result.usage:
            u = result.usage
            if hasattr(u, "input_tokens"):
                usage.prompt_tokens = u.input_tokens
            elif hasattr(u, "prompt_tokens"):
                usage.prompt_tokens = u.prompt_tokens
            if hasattr(u, "output_tokens"):
                usage.completion_tokens = u.output_tokens
            elif hasattr(u, "completion_tokens"):
                usage.completion_tokens = u.completion_tokens
            usage.total_tokens = usage.prompt_tokens + usage.completion_tokens
        return usage

    def _extract_tool_calls(self, result: Any) -> list:
        """Try to extract tool calls from result (OpenAI format)."""
        tool_calls = []
        if hasattr(result, "choices") and result.choices:
            choice = result.choices[0]
            if hasattr(choice, "message") and hasattr(choice.message, "tool_calls"):
                if choice.message.tool_calls:
                    for tc in choice.message.tool_calls:
                        tool_calls.append(ToolCallRequest(
                            tool_call_id=tc.id,
                            tool_name=tc.function.name,
                            arguments_raw=tc.function.arguments,
                        ))
        return tool_calls

    def __call__(self, *args, **kwargs) -> Any:
        if self._is_async:
            return self._call_async(*args, **kwargs)
        return self._call_sync(*args, **kwargs)

    def _call_sync(self, *args, **kwargs) -> Any:
        llm_call = LLMCall(
            provider=self._provider,
            model=self._model,
            request_messages=self._extract_messages(args, kwargs),
        )
        with LLMCallContext(llm_call):
            try:
                result = self._func(*args, **kwargs)
                llm_call.response_content = self._extract_response_content(result)
                llm_call.usage = self._extract_usage(result)
                llm_call.response_tool_calls = self._extract_tool_calls(result)
                llm_call.response_finish_reason = "stop"
                llm_call.complete()

                # Track LLM calls with tool calls for tool-LLM linking
                if llm_call.response_tool_calls:
                    set_last_llm_call_with_tools(llm_call)

                return result
            except Exception as e:
                llm_call.response_finish_reason = f"error: {str(e)}"
                llm_call.complete()
                raise
            finally:
                record_llm_call(llm_call)

    async def _call_async(self, *args, **kwargs) -> Any:
        llm_call = LLMCall(
            provider=self._provider,
            model=self._model,
            request_messages=self._extract_messages(args, kwargs),
        )
        with LLMCallContext(llm_call):
            try:
                result = await self._func(*args, **kwargs)
                llm_call.response_content = self._extract_response_content(result)
                llm_call.usage = self._extract_usage(result)
                llm_call.response_tool_calls = self._extract_tool_calls(result)
                llm_call.response_finish_reason = "stop"
                llm_call.complete()

                # Track LLM calls with tool calls for tool-LLM linking
                if llm_call.response_tool_calls:
                    set_last_llm_call_with_tools(llm_call)

                return result
            except Exception as e:
                llm_call.response_finish_reason = f"error: {str(e)}"
                llm_call.complete()
                raise
            finally:
                record_llm_call(llm_call)


def llm(
    func: Callable = None,
    *,
    provider: str = "unknown",
    model: str = "unknown",
) -> Union[LLMWrapper, Callable]:
    """
    Decorator for tracing LLM calls to non-OpenAI providers.

    Usage:
        @llm(provider="anthropic", model="claude-3-opus-20240229")
        def call_claude(messages: list) -> str:
            response = anthropic.messages.create(
                model="claude-3-opus-20240229",
                messages=messages
            )
            return response.content[0].text

        @llm(provider="google", model="gemini-pro")
        async def call_gemini(prompt: str) -> str:
            response = await genai.generate_content_async(prompt)
            return response.text
    """
    def decorator(f: Callable) -> LLMWrapper:
        return LLMWrapper(f, provider=provider, model=model)

    if func is not None:
        return decorator(func)
    return decorator
