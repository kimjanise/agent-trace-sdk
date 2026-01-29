from typing import Any, Callable, Union
import asyncio
import inspect
from .models import STTCall
from .context import record_stt_call


class STTWrapper:
    def __init__(
        self,
        func: Callable,
        provider: str = "unknown",
        model: str = "unknown",
        audio_format: str = None,
        language: str = None,
    ):
        self._func = func
        self._provider = provider
        self._model = model
        self._audio_format = audio_format
        self._language = language
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

    def __call__(self, *args, **kwargs) -> Any:
        if self._is_async:
            return self._call_async(*args, **kwargs)
        return self._call_sync(*args, **kwargs)

    def _call_sync(self, *args, **kwargs) -> Any:
        stt_call = STTCall(
            provider=self._provider,
            model=self._model,
            audio_format=self._audio_format,
            language=self._language,
        )
        try:
            result = self._func(*args, **kwargs)
            transcript = result if isinstance(result, str) else str(result)
            stt_call.complete(transcript=transcript)
            return result
        except Exception as e:
            stt_call.complete(error=str(e))
            raise
        finally:
            record_stt_call(stt_call)

    async def _call_async(self, *args, **kwargs) -> Any:
        stt_call = STTCall(
            provider=self._provider,
            model=self._model,
            audio_format=self._audio_format,
            language=self._language,
        )
        try:
            result = await self._func(*args, **kwargs)
            transcript = result if isinstance(result, str) else str(result)
            stt_call.complete(transcript=transcript)
            return result
        except Exception as e:
            stt_call.complete(error=str(e))
            raise
        finally:
            record_stt_call(stt_call)


def stt(
    func: Callable = None,
    *,
    provider: str = "unknown",
    model: str = "unknown",
    audio_format: str = None,
    language: str = None,
) -> Union[STTWrapper, Callable]:
    """
    Decorator for tracing Speech-to-Text operations.

    Usage:
        @stt(provider="deepgram", model="nova-2")
        def transcribe(audio_path: str) -> str:
            return deepgram_client.transcribe(audio_path)

        @stt(provider="assemblyai")
        async def transcribe_async(audio_url: str) -> str:
            return await assemblyai.transcribe(audio_url)
    """
    def decorator(f: Callable) -> STTWrapper:
        return STTWrapper(
            f,
            provider=provider,
            model=model,
            audio_format=audio_format,
            language=language,
        )

    if func is not None:
        return decorator(func)
    return decorator
