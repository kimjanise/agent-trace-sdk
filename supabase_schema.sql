-- Supabase Schema for Agent Trace SDK
-- Run this in your Supabase SQL Editor to set up the tables

-- Traces table: stores top-level agent execution traces
CREATE TABLE traces (
  trace_id UUID PRIMARY KEY,
  agent_name TEXT NOT NULL,
  input TEXT,
  output TEXT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL,  -- 'active', 'completed', 'error'
  metadata JSONB DEFAULT '{}',
  total_tokens INT DEFAULT 0,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLM Calls table: stores individual LLM API calls within a trace
CREATE TABLE llm_calls (
  call_id UUID PRIMARY KEY,
  trace_id UUID REFERENCES traces(trace_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  request_messages JSONB,
  request_tools JSONB,
  request_system_prompt TEXT,
  request_temperature FLOAT,
  request_max_tokens INT,
  response_content TEXT,
  response_tool_calls JSONB,
  response_finish_reason TEXT,
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_ms INT,
  streaming BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_llm_calls_trace_id ON llm_calls(trace_id);

-- Tool Executions table: stores tool/function calls within a trace
CREATE TABLE tool_executions (
  execution_id UUID PRIMARY KEY,
  trace_id UUID REFERENCES traces(trace_id) ON DELETE CASCADE,
  llm_call_id UUID REFERENCES llm_calls(call_id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  arguments JSONB,
  result TEXT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_ms INT,
  status TEXT NOT NULL  -- 'pending', 'success', 'error'
);

CREATE INDEX idx_tool_executions_trace_id ON tool_executions(trace_id);
CREATE INDEX idx_tool_executions_llm_call_id ON tool_executions(llm_call_id);
