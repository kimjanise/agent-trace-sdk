# Agent Trace SDK

A tracing and visualization framework for LLM-powered agent executions. Capture detailed execution traces including LLM calls, tool invocations, and agent workflows, then visualize them through an interactive web UI.

## Installation

```bash
pip install agent-trace-sdk
```

For Supabase storage support:
```bash
pip install agent-trace-sdk supabase
```

## Quick Start

```python
from openai import OpenAI
from agent_trace import tool, agent, llm, configure

# Configure storage (auto-detects SUPABASE_URL/SUPABASE_KEY env vars)
configure()

client = OpenAI()

@tool
def get_weather(location: str) -> dict:
    """Fetch current weather for a location."""
    return {"location": location, "temperature": 72, "conditions": "sunny"}

@llm(provider="openai", model="gpt-4o")
def call_llm(messages: list, tools: list = None):
    kwargs = {"model": "gpt-4o", "messages": messages}
    if tools:
        kwargs["tools"] = tools
    return client.chat.completions.create(**kwargs)

@agent
def weather_agent(query: str) -> str:
    response = call_llm(
        messages=[{"role": "user", "content": query}],
        tools=[{"type": "function", "function": get_weather.schema}]
    )

    if response.choices[0].message.tool_calls:
        tool_call = response.choices[0].message.tool_calls[0]
        result = get_weather(**json.loads(tool_call.function.arguments))
        return f"Weather: {result}"

    return response.choices[0].message.content

# Run the agent - trace is automatically captured and saved
result = weather_agent("What's the weather in Tokyo?")
```

## Core Components

### `@agent` Decorator

Wraps a function as a traced agent. Creates a `Trace` object that captures all LLM calls and tool executions within its scope.

```python
from agent_trace import agent, get_trace

@agent
def my_agent(input: str) -> str:
    # All LLM calls and tool executions here are traced
    return process(input)

@agent(name="custom_name")
def named_agent(input: str) -> str:
    return process(input)

# Access the last trace after execution
result = my_agent("hello")
trace = my_agent.last_trace
```

**Features:**
- Automatic trace lifecycle management
- Captures input/output and errors
- Supports both sync and async functions
- Auto-saves to configured storage backend

### `@tool` Decorator

Wraps a function as a traced tool with automatic JSON schema generation for OpenAI function calling.

```python
from agent_trace import tool

@tool
def search_database(query: str, limit: int = 10) -> list:
    """Search the database for matching records."""
    return db.search(query, limit)

# Auto-generated schema for OpenAI tools
print(search_database.schema)
# {
#   "name": "search_database",
#   "description": "Search the database for matching records.",
#   "parameters": {
#     "type": "object",
#     "properties": {
#       "query": {"type": "string"},
#       "limit": {"type": "integer"}
#     },
#     "required": ["query"]
#   }
# }

# Use with OpenAI
response = call_llm(
    messages=[...],
    tools=[{"type": "function", "function": search_database.schema}]
)
```

**Features:**
- Automatic JSON schema generation from Python type hints
- Captures arguments, results, and errors
- Links executions to parent LLM calls
- Supports both sync and async functions

### `@llm` Decorator

Wraps a function as a traced LLM call. Works with any LLM provider (OpenAI, Anthropic, Google, etc.).

```python
from agent_trace import llm

@llm(provider="openai", model="gpt-4o")
def call_openai(messages: list) -> str:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages
    )
    return response.choices[0].message.content

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

# Use within an agent
result = call_openai([{"role": "user", "content": "Hello"}])
```

**Captured data:**
- Provider and model
- Request messages (auto-extracted from common parameter names)
- Response content (auto-extracted from common response formats)
- Token usage (if available in response)
- Timing and status

### `@stt` Decorator

Wraps a function as a traced Speech-to-Text operation.

```python
from agent_trace import stt

@stt(provider="openai", model="whisper-1")
def transcribe_openai(audio_path: str) -> str:
    with open(audio_path, "rb") as f:
        return client.audio.transcriptions.create(model="whisper-1", file=f).text

@stt(provider="deepgram", model="nova-2")
def transcribe_deepgram(audio_path: str) -> str:
    return deepgram_client.transcribe(audio_path)

@stt(provider="assemblyai", model="best")
async def transcribe_async(audio_url: str) -> str:
    return await assemblyai.transcribe(audio_url)

# Use within an agent
result = transcribe_openai("recording.wav")
```

**Captured data:**
- Provider and model
- Audio format and duration
- Language (detected or specified)
- Transcript output
- Timing and status

### `@tts` Decorator

Wraps a function as a traced Text-to-Speech operation.

```python
from agent_trace import tts

@tts(provider="openai", model="tts-1", voice="alloy")
def speak_openai(text: str) -> bytes:
    return client.audio.speech.create(model="tts-1", input=text, voice="alloy").content

@tts(provider="elevenlabs", voice="rachel")
def synthesize(text: str) -> bytes:
    return elevenlabs.generate(text=text, voice="rachel")

@tts(provider="google", model="en-US-Neural2-A")
async def speak_async(text: str) -> bytes:
    return await google_tts.synthesize(text)

# Use within an agent
audio_data = speak_openai("Hello, world!")
```

**Captured data:**
- Provider, model, and voice
- Input text and character count
- Output format and duration
- Voice settings
- Timing and status

## Storage Backends

### In-Memory Storage

For development and testing:

```python
from agent_trace import configure, InMemoryTraceStore

store = InMemoryTraceStore()
configure(store=store)

# After agent execution
traces = store.list()
trace = store.get(trace_id)
store.clear()
```

### File Storage

Persist traces as JSON files:

```python
from agent_trace import configure, FileTraceStore

configure(store=FileTraceStore("./traces"))
# Creates ./traces/{trace_id}.json for each trace
```

### Supabase Storage

Production-ready cloud storage:

```python
from agent_trace import configure, SupabaseTraceStore

# Option 1: Auto-configure from environment variables
# Set SUPABASE_URL and SUPABASE_KEY
configure()

# Option 2: Explicit configuration
configure(
    supabase_url="https://xxx.supabase.co",
    supabase_key="your-anon-key"
)

# Option 3: Direct store instance
store = SupabaseTraceStore(url="...", key="...")
configure(store=store)
```

**Required Supabase tables:**

```sql
-- traces table
create table traces (
  trace_id text primary key,
  agent_name text,
  input text,
  output text,
  error text,
  started_at timestamptz,
  ended_at timestamptz,
  status text,
  metadata jsonb,
  total_tokens integer,
  duration_ms integer
);

-- llm_calls table
create table llm_calls (
  call_id text primary key,
  trace_id text references traces(trace_id),
  provider text,
  model text,
  request_messages jsonb,
  request_tools jsonb,
  request_system_prompt text,
  request_temperature float,
  request_max_tokens integer,
  response_content text,
  response_tool_calls jsonb,
  response_finish_reason text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms integer,
  streaming boolean
);

-- tool_executions table
create table tool_executions (
  execution_id text primary key,
  trace_id text references traces(trace_id),
  llm_call_id text references llm_calls(call_id),
  tool_name text,
  arguments jsonb,
  result text,
  error text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms integer,
  status text
);

-- stt_calls table (Speech-to-Text)
create table stt_calls (
  call_id text primary key,
  trace_id text references traces(trace_id),
  provider text,
  model text,
  audio_duration_ms integer,
  audio_format text,
  language text,
  transcript text,
  confidence float,
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms integer,
  status text,
  error text
);

-- tts_calls table (Text-to-Speech)
create table tts_calls (
  call_id text primary key,
  trace_id text references traces(trace_id),
  provider text,
  model text,
  voice text,
  input_text text,
  input_chars integer,
  output_audio_duration_ms integer,
  output_format text,
  voice_settings jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  duration_ms integer,
  status text,
  error text
);
```

## Data Models

### Trace

Root container for an agent execution:

```python
@dataclass
class Trace:
    trace_id: str
    agent_name: str
    input: Any
    output: Any
    error: Optional[str]
    started_at: datetime
    ended_at: Optional[datetime]
    status: TraceStatus  # ACTIVE | COMPLETED | ERROR
    llm_calls: list[LLMCall]
    tool_executions: list[ToolExecution]
    metadata: dict

    # Computed properties
    duration_ms: Optional[int]
    total_tokens: int
    total_llm_calls: int
    total_tool_executions: int
```

### LLMCall

Captures a single LLM API call:

```python
@dataclass
class LLMCall:
    call_id: str
    provider: str
    model: str

    # Request
    request_messages: list
    request_tools: list
    request_system_prompt: Optional[str]
    request_temperature: Optional[float]
    request_max_tokens: Optional[int]

    # Response
    response_content: Optional[str]
    response_tool_calls: list[ToolCallRequest]
    response_finish_reason: Optional[str]
    usage: TokenUsage

    # Timing
    started_at: datetime
    ended_at: Optional[datetime]
    duration_ms: Optional[int]
    streaming: bool
```

### ToolExecution

Captures a tool invocation:

```python
@dataclass
class ToolExecution:
    execution_id: str
    tool_name: str
    arguments: dict
    result: Any
    error: Optional[str]
    started_at: datetime
    ended_at: Optional[datetime]
    duration_ms: Optional[int]
    status: ToolExecutionStatus  # PENDING | SUCCESS | ERROR
    llm_call_id: Optional[str]  # Links to parent LLM call
```

### STTCall

Captures a Speech-to-Text operation:

```python
@dataclass
class STTCall:
    call_id: str
    provider: str
    model: str
    audio_duration_ms: Optional[int]
    audio_format: Optional[str]
    language: Optional[str]
    transcript: Optional[str]
    confidence: Optional[float]
    started_at: datetime
    ended_at: Optional[datetime]
    duration_ms: Optional[int]
    status: STTStatus  # PENDING | SUCCESS | ERROR
    error: Optional[str]
```

### TTSCall

Captures a Text-to-Speech operation:

```python
@dataclass
class TTSCall:
    call_id: str
    provider: str
    model: str
    voice: Optional[str]
    input_text: str
    input_chars: int
    output_audio_duration_ms: Optional[int]
    output_format: Optional[str]
    voice_settings: Optional[dict]
    started_at: datetime
    ended_at: Optional[datetime]
    duration_ms: Optional[int]
    status: TTSStatus  # PENDING | SUCCESS | ERROR
    error: Optional[str]
```

## Async Support

All components support async functions:

```python
from openai import AsyncOpenAI
from agent_trace import tool, agent, llm
import asyncio

client = AsyncOpenAI()

@tool
async def async_search(query: str) -> list:
    await asyncio.sleep(0.1)  # Simulate async operation
    return ["result1", "result2"]

@llm(provider="openai", model="gpt-4o")
async def call_openai_async(messages: list, tools: list = None):
    kwargs = {"model": "gpt-4o", "messages": messages}
    if tools:
        kwargs["tools"] = tools
    return await client.chat.completions.create(**kwargs)

@agent
async def async_agent(query: str) -> str:
    response = await call_openai_async(
        messages=[{"role": "user", "content": query}],
        tools=[{"type": "function", "function": async_search.schema}]
    )
    return response.choices[0].message.content

result = asyncio.run(async_agent("search for documents"))
```

## Context Management

Access the current trace from within an agent:

```python
from agent_trace import agent, get_trace

@agent
def my_agent(input: str) -> str:
    trace = get_trace()
    if trace:
        trace.metadata["custom_field"] = "value"
    return process(input)
```

## Web UI

The `trace-ui` directory contains a Next.js application for visualizing traces.

### Setup

```bash
cd trace-ui
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=your-anon-key
```

### Run

```bash
npm run dev
# Opens at http://localhost:3001
```

### Features

- **Trace Table**: Browse all traces with filtering by agent name and status
- **Tree View**: Hierarchical visualization of agent → LLM calls → tool executions
- **Step Detail**: Inspect individual LLM calls and tool executions with JSON/Text toggle
- **Error Tracking**: Visual error indicators with navigation to failed steps

## API Reference

### Configuration

```python
configure(
    store: TraceStore = None,
    supabase_url: str = None,
    supabase_key: str = None
) -> None
```

### Decorators

```python
@agent(name: str = None) -> AgentWrapper
@tool(name: str = None, description: str = None) -> ToolWrapper
@llm(provider: str, model: str) -> LLMWrapper
@stt(provider: str, model: str, audio_format: str = None, language: str = None) -> STTWrapper
@tts(provider: str, model: str, voice: str = None, output_format: str = None) -> TTSWrapper
```

### Context Functions

```python
get_trace() -> Optional[Trace]
get_current_trace() -> Optional[Trace]
```

### Storage Classes

```python
class TraceStore(ABC):
    def save(trace: Trace) -> None
    def get(trace_id: str) -> Optional[Trace]
    def list(limit: int = 100) -> List[Trace]

class InMemoryTraceStore(TraceStore)
class FileTraceStore(TraceStore)
class SupabaseTraceStore(TraceStore)
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anonymous key |
| `OPENAI_API_KEY` | OpenAI API key (for examples) |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend Supabase URL |
| `NEXT_PUBLIC_SUPABASE_KEY` | Frontend Supabase key |

## Project Structure

```
agent-trace-sdk/
├── agent_trace/
│   ├── __init__.py        # Public API
│   ├── models.py          # Data models
│   ├── agent.py           # @agent decorator
│   ├── tool.py            # @tool decorator
│   ├── llm.py             # @llm decorator
│   ├── stt.py             # @stt decorator
│   ├── tts.py             # @tts decorator
│   ├── context.py         # Context management
│   ├── config.py          # Configuration
│   └── storage.py         # Storage backends
├── trace-ui/
│   └── src/
│       ├── app/           # Next.js pages
│       ├── components/    # React components
│       ├── lib/           # Supabase client
│       └── types/         # TypeScript types
└── examples/
    ├── single_tool_agent.py
    ├── multi_tool_agent.py
    ├── parallel_agent.py
    └── multi_turn_agent.py
```

## License

MIT
