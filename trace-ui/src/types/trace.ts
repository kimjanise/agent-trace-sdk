export interface Trace {
  trace_id: string;
  agent_name: string;
  input: string | null;
  output: string | null;
  error: string | null;
  started_at: string;
  ended_at: string | null;
  status: "active" | "completed" | "error";
  metadata: Record<string, unknown>;
  total_tokens: number;
  duration_ms: number | null;
  created_at: string;
  // Computed field for UI
  tool_error_count?: number;
}

export interface LLMCall {
  call_id: string;
  trace_id: string;
  provider: string;
  model: string;
  request_messages: Array<{ role: string; content: string }>;
  request_tools: unknown[];
  request_system_prompt: string | null;
  request_temperature: number | null;
  request_max_tokens: number | null;
  response_content: string | null;
  response_tool_calls: Array<{
    tool_call_id: string;
    tool_name: string;
    arguments_raw: string;
  }>;
  response_finish_reason: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  streaming: boolean;
}

export interface ToolExecution {
  execution_id: string;
  trace_id: string;
  llm_call_id: string | null;
  tool_name: string;
  arguments: Record<string, unknown>;
  result: string | null;
  error: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  status: "pending" | "success" | "error";
}

export interface STTCall {
  call_id: string;
  trace_id: string;
  provider: string;
  model: string;
  audio_duration_ms: number | null;
  audio_format: string | null;
  language: string | null;
  transcript: string | null;
  confidence: number | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  status: "pending" | "success" | "error";
  error: string | null;
}

export interface TTSCall {
  call_id: string;
  trace_id: string;
  provider: string;
  model: string;
  voice: string | null;
  input_text: string;
  input_chars: number;
  output_audio_duration_ms: number | null;
  output_format: string | null;
  voice_settings: Record<string, unknown> | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  status: "pending" | "success" | "error";
  error: string | null;
}

export type StepType = "agent" | "llm" | "tool" | "stt" | "tts";

export interface TreeNode {
  id: string;
  type: StepType;
  name: string;
  duration_ms: number | null;
  tokens?: number;
  status?: string;
  data: Trace | LLMCall | ToolExecution | STTCall | TTSCall;
  children: TreeNode[];
}
