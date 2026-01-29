from typing import Any, Callable, Optional, Union
import asyncio
import inspect
from .models import TTSCall
from .context import record_tts_call


class TTSWrapper:
    def __init__(
        self,
        func: Callable,
        provider: str = "unknown",
        model: str = "unknown",
        voice: str = None,
        output_format: str = None,
    ):
        self._func = func
        self._provider = provider
        self._model = model
        self._voice = voice
        self._output_format = output_format
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

    @property
    def voice(self) -> Optional[str]:
        return self._voice

    def _extract_input_text(self, args: tuple, kwargs: dict) -> str:
        """Try to extract input text from arguments."""
        # Check common parameter names
        for key in ["text", "input", "input_text", "content", "message"]:
            if key in kwargs:
                return str(kwargs[key])

        # Fall back to first string argument
        for arg in args:
            if isinstance(arg, str):
                return arg

        return ""

    def __call__(self, *args, **kwargs) -> Any:
        if self._is_async:
            return self._call_async(*args, **kwargs)
        return self._call_sync(*args, **kwargs)

    def _call_sync(self, *args, **kwargs) -> Any:
        input_text = self._extract_input_text(args, kwargs)
        tts_call = TTSCall(
            provider=self._provider,
            model=self._model,
            voice=self._voice,
            input_text=input_text,
            input_chars=len(input_text),
            output_format=self._output_format,
        )
        try:
            result = self._func(*args, **kwargs)
            tts_call.complete()
            return result
        except Exception as e:
            tts_call.complete(error=str(e))
            raise
        finally:
            record_tts_call(tts_call)

    async def _call_async(self, *args, **kwargs) -> Any:
        input_text = self._extract_input_text(args, kwargs)
        tts_call = TTSCall(
            provider=self._provider,
            model=self._model,
            voice=self._voice,
            input_text=input_text,
            input_chars=len(input_text),
            output_format=self._output_format,
        )
        try:
            result = await self._func(*args, **kwargs)
            tts_call.complete()
            return result
        except Exception as e:
            tts_call.complete(error=str(e))
            raise
        finally:
            record_tts_call(tts_call)


def tts(
    func: Callable = None,
    *,
    provider: str = "unknown",
    model: str = "unknown",
    voice: str = None,
    output_format: str = None,
) -> Union[TTSWrapper, Callable]:
    """
    Decorator for tracing Text-to-Speech operations.

    Usage:
        @tts(provider="elevenlabs", voice="rachel")
        def synthesize(text: str) -> bytes:
            return elevenlabs.generate(text=text, voice="rachel")

        @tts(provider="google", model="en-US-Neural2-A")
        async def synthesize_async(text: str) -> bytes:
            return await google_tts.synthesize(text)
    """
    def decorator(f: Callable) -> TTSWrapper:
        return TTSWrapper(
            f,
            provider=provider,
            model=model,
            voice=voice,
            output_format=output_format,
        )

    if func is not None:
        return decorator(func)
    return decorator
