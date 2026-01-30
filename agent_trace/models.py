from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from enum import Enum
import uuid


def generate_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.utcnow()


class ToolExecutionStatus(Enum):
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"
    PENDING = "PENDING"


class STTStatus(Enum):
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"
    PENDING = "PENDING"


class TTSStatus(Enum):
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"
    PENDING = "PENDING"


@dataclass
class ToolExecution:
    execution_id: str = field(default_factory=generate_id)
    tool_name: str = ""
    arguments: dict = field(default_factory=dict)
    result: Any = None
    error: Optional[str] = None
    started_at: datetime = field(default_factory=now)
    ended_at: Optional[datetime] = None
    status: ToolExecutionStatus = ToolExecutionStatus.PENDING
    llm_call_id: Optional[str] = None
    
    def complete(self, result: Any = None, error: str = None) -> None:
        self.ended_at = now()
        if error:
            self.error = error
            self.status = ToolExecutionStatus.ERROR
        else:
            self.result = result
            self.status = ToolExecutionStatus.SUCCESS
    
    @property
    def duration_ms(self) -> Optional[int]:
        if self.ended_at is None:
            return None
        delta = self.ended_at - self.started_at
        return int(delta.total_seconds() * 1000)
    
    def to_dict(self) -> dict:
        return {
            "execution_id": self.execution_id,
            "tool_name": self.tool_name,
            "arguments": self.arguments,
            "result": str(self.result) if self.result else None,
            "error": self.error,
            "duration_ms": self.duration_ms,
            "status": self.status.value,
        }


@dataclass
class ToolCallRequest:
    tool_call_id: str
    tool_name: str
    arguments_raw: str
    arguments_parsed: Optional[dict] = None


@dataclass
class STTCall:
    call_id: str = field(default_factory=generate_id)
    provider: str = "unknown"
    model: str = "unknown"

    audio_duration_ms: Optional[int] = None
    audio_format: Optional[str] = None
    language: Optional[str] = None

    transcript: Optional[str] = None
    confidence: Optional[float] = None
    word_timestamps: Optional[list] = None

    started_at: datetime = field(default_factory=now)
    ended_at: Optional[datetime] = None
    status: STTStatus = STTStatus.PENDING
    error: Optional[str] = None

    def complete(self, transcript: str = None, error: str = None) -> None:
        self.ended_at = now()
        if error:
            self.error = error
            self.status = STTStatus.ERROR
        else:
            self.transcript = transcript
            self.status = STTStatus.SUCCESS

    @property
    def duration_ms(self) -> Optional[int]:
        if self.ended_at is None:
            return None
        return int((self.ended_at - self.started_at).total_seconds() * 1000)


@dataclass
class TTSCall:
    call_id: str = field(default_factory=generate_id)
    provider: str = "unknown"
    model: str = "unknown"
    voice: Optional[str] = None

    input_text: str = ""
    input_chars: int = 0

    output_audio_duration_ms: Optional[int] = None
    output_format: Optional[str] = None
    voice_settings: Optional[dict] = None

    started_at: datetime = field(default_factory=now)
    ended_at: Optional[datetime] = None
    status: TTSStatus = TTSStatus.PENDING
    error: Optional[str] = None

    def complete(self, error: str = None) -> None:
        self.ended_at = now()
        if error:
            self.error = error
            self.status = TTSStatus.ERROR
        else:
            self.status = TTSStatus.SUCCESS

    @property
    def duration_ms(self) -> Optional[int]:
        if self.ended_at is None:
            return None
        return int((self.ended_at - self.started_at).total_seconds() * 1000)


@dataclass
class TokenUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class LLMCall:
    call_id: str = field(default_factory=generate_id)
    provider: str = "unknown"
    model: str = "unknown"
    
    request_messages: list = field(default_factory=list)
    request_tools: list = field(default_factory=list)
    request_system_prompt: Optional[str] = None
    request_temperature: Optional[float] = None
    request_max_tokens: Optional[int] = None
    
    response_content: Optional[str] = None
    response_tool_calls: list = field(default_factory=list)
    response_finish_reason: Optional[str] = None
    usage: TokenUsage = field(default_factory=TokenUsage)
    
    started_at: datetime = field(default_factory=now)
    ended_at: Optional[datetime] = None
    streaming: bool = False
    
    def complete(self) -> None:
        self.ended_at = now()
    
    @property
    def duration_ms(self) -> Optional[int]:
        if self.ended_at is None:
            return None
        return int((self.ended_at - self.started_at).total_seconds() * 1000)
    
    @property
    def has_tool_calls(self) -> bool:
        return len(self.response_tool_calls) > 0


class TraceStatus(Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class Trace:
    trace_id: str = field(default_factory=generate_id)
    agent_name: str = "unnamed_agent"
    input: Any = None
    output: Any = None
    error: Optional[str] = None
    started_at: datetime = field(default_factory=now)
    ended_at: Optional[datetime] = None
    status: TraceStatus = TraceStatus.ACTIVE
    llm_calls: list = field(default_factory=list)
    tool_executions: list = field(default_factory=list)
    stt_calls: list = field(default_factory=list)
    tts_calls: list = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def add_llm_call(self, llm_call: LLMCall) -> None:
        self.llm_calls.append(llm_call)

    def add_tool_execution(self, execution: ToolExecution) -> None:
        self.tool_executions.append(execution)

    def add_stt_call(self, stt_call: STTCall) -> None:
        self.stt_calls.append(stt_call)

    def add_tts_call(self, tts_call: TTSCall) -> None:
        self.tts_calls.append(tts_call)
    
    def complete(self, output: Any = None, error: str = None) -> None:
        self.ended_at = now()
        if error:
            self.error = error
            self.status = TraceStatus.ERROR
        else:
            self.output = output
            self.status = TraceStatus.COMPLETED
    
    @property
    def duration_ms(self) -> Optional[int]:
        if self.ended_at is None:
            return None
        return int((self.ended_at - self.started_at).total_seconds() * 1000)
    
    @property
    def total_tokens(self) -> int:
        return sum(call.usage.total_tokens for call in self.llm_calls)
    
    @property
    def total_llm_calls(self) -> int:
        return len(self.llm_calls)
    
    @property
    def total_tool_executions(self) -> int:
        return len(self.tool_executions)
    
    def to_dict(self) -> dict:
        return {
            "trace_id": self.trace_id,
            "agent_name": self.agent_name,
            "input": str(self.input),
            "output": str(self.output),
            "error": self.error,
            "duration_ms": self.duration_ms,
            "status": self.status.value,
            "llm_calls": [c.call_id for c in self.llm_calls],
            "tool_executions": [e.to_dict() for e in self.tool_executions],
            "total_tokens": self.total_tokens,
        }
    
    def to_json(self, indent: int = 2) -> str:
        import json
        return json.dumps(self.to_dict(), indent=indent, default=str)