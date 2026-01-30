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

    def _extract_audio_duration_ms(self, args: tuple, kwargs: dict) -> int | None:
        """Try to extract audio duration from arguments."""
        # Check common parameter names
        for key in ["audio_duration_ms", "duration_ms", "duration", "audio_duration"]:
            if key in kwargs:
                val = kwargs[key]
                if isinstance(val, (int, float)):
                    # If it looks like seconds (< 1000), convert to ms
                    if key in ["duration", "audio_duration"] and val < 1000:
                        return int(val * 1000)
                    return int(val)
        return None

    def _extract_duration_from_result(self, result: Any) -> int | None:
        """Try to extract audio duration from STT result (e.g., Deepgram response)."""
        # Try to convert to dict if the object has that method (Deepgram SDK v3)
        result_dict = None
        if hasattr(result, "to_dict"):
            try:
                result_dict = result.to_dict()
            except Exception:
                pass

        # Deepgram format: result.metadata.duration
        if hasattr(result, "metadata"):
            metadata = result.metadata
            if hasattr(metadata, "duration") and metadata.duration:
                # Deepgram returns duration in seconds
                return int(float(metadata.duration) * 1000)
            # Try dict-style access on metadata
            if hasattr(metadata, "get"):
                duration = metadata.get("duration")
                if duration:
                    return int(float(duration) * 1000)

        # Try nested results structure (alternative location)
        if hasattr(result, "results"):
            results = result.results
            if hasattr(results, "channels") and results.channels:
                channel = results.channels[0]
                if hasattr(channel, "alternatives") and channel.alternatives:
                    alt = channel.alternatives[0]
                    # Check for words array to calculate duration
                    if hasattr(alt, "words") and alt.words:
                        last_word = alt.words[-1]
                        if hasattr(last_word, "end"):
                            return int(float(last_word.end) * 1000)

        # Dict format (for JSON responses or to_dict() result)
        for d in [result_dict, result] if result_dict else [result]:
            if isinstance(d, dict):
                if "metadata" in d and d["metadata"]:
                    duration = d["metadata"].get("duration")
                    if duration:
                        return int(float(duration) * 1000)
                if "results" in d:
                    channels = d["results"].get("channels", [])
                    if channels:
                        alts = channels[0].get("alternatives", [])
                        if alts:
                            # Try duration field
                            duration = alts[0].get("duration")
                            if duration:
                                return int(float(duration) * 1000)
                            # Try calculating from words
                            words = alts[0].get("words", [])
                            if words:
                                last_word = words[-1]
                                end_time = last_word.get("end")
                                if end_time:
                                    return int(float(end_time) * 1000)

        return None

    def _extract_transcript_from_result(self, result: Any) -> str | None:
        """Try to extract transcript from STT result."""
        # If it's already a string, return it
        if isinstance(result, str):
            return result

        # Deepgram format
        if hasattr(result, "results"):
            results = result.results
            if hasattr(results, "channels") and results.channels:
                channel = results.channels[0]
                if hasattr(channel, "alternatives") and channel.alternatives:
                    alt = channel.alternatives[0]
                    if hasattr(alt, "transcript"):
                        return alt.transcript

        # OpenAI Whisper format
        if hasattr(result, "text"):
            return result.text

        # Dict format
        if isinstance(result, dict):
            if "text" in result:
                return result["text"]
            if "transcript" in result:
                return result["transcript"]
            if "results" in result:
                channels = result["results"].get("channels", [])
                if channels and channels[0].get("alternatives"):
                    return channels[0]["alternatives"][0].get("transcript")

        return None

    def __call__(self, *args, **kwargs) -> Any:
        if self._is_async:
            return self._call_async(*args, **kwargs)
        return self._call_sync(*args, **kwargs)

    def _call_sync(self, *args, **kwargs) -> Any:
        # Pop tracing kwargs before calling the actual function
        audio_duration_ms = kwargs.pop("audio_duration_ms", None) or kwargs.pop("duration_ms", None)
        if audio_duration_ms is None:
            audio_duration_ms = self._extract_audio_duration_ms(args, kwargs)
        stt_call = STTCall(
            provider=self._provider,
            model=self._model,
            function_name=self._func.__name__,
            audio_format=self._audio_format,
            language=self._language,
            audio_duration_ms=int(audio_duration_ms) if audio_duration_ms else None,
        )
        try:
            result = self._func(*args, **kwargs)
            # Try to extract duration from result if not already set
            if stt_call.audio_duration_ms is None:
                extracted_duration = self._extract_duration_from_result(result)
                if extracted_duration:
                    stt_call.audio_duration_ms = extracted_duration
            # Extract transcript - try structured result first, fall back to string conversion
            transcript = self._extract_transcript_from_result(result)
            if transcript is None:
                transcript = str(result) if result else ""
            stt_call.complete(transcript=transcript)
            return result
        except Exception as e:
            stt_call.complete(error=str(e))
            raise
        finally:
            record_stt_call(stt_call)

    async def _call_async(self, *args, **kwargs) -> Any:
        # Pop tracing kwargs before calling the actual function
        audio_duration_ms = kwargs.pop("audio_duration_ms", None) or kwargs.pop("duration_ms", None)
        if audio_duration_ms is None:
            audio_duration_ms = self._extract_audio_duration_ms(args, kwargs)
        stt_call = STTCall(
            provider=self._provider,
            model=self._model,
            function_name=self._func.__name__,
            audio_format=self._audio_format,
            language=self._language,
            audio_duration_ms=int(audio_duration_ms) if audio_duration_ms else None,
        )
        try:
            result = await self._func(*args, **kwargs)
            # Try to extract duration from result if not already set
            if stt_call.audio_duration_ms is None:
                extracted_duration = self._extract_duration_from_result(result)
                if extracted_duration:
                    stt_call.audio_duration_ms = extracted_duration
            # Extract transcript - try structured result first, fall back to string conversion
            transcript = self._extract_transcript_from_result(result)
            if transcript is None:
                transcript = str(result) if result else ""
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
