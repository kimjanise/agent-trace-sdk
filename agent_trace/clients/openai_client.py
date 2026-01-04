from typing import Any, Optional
import json
from ..models import LLMCall, ToolCallRequest, TokenUsage
from ..context import record_llm_call, set_last_llm_call_with_tools

class TracedOpenAICompletions:
    def __init__(self, original_completions, provider: str = "openai"):
        self._original = original_completions
        self._provider = provider

    def create(self, **kwargs) -> Any:
        llm_call = self._create_llm_call(kwargs)
        
        try:
            response = self._original.create(**kwargs)
            self._record_response(llm_call, response)
            return response
        except Exception as e:
            llm_call.complete()
            llm_call.response_finish_reason = f"error: {str(e)}"
            record_llm_call(llm_call)
            raise
    
    def _create_llm_call(self, kwargs: dict) -> LLMCall:
        llm_call = LLMCall(
            provider=self._provider,
            model=kwargs.get("model", "unknown"),
        )

        messages = kwargs.get("messages", [])
        # Convert Pydantic objects to dicts for storage
        serialized_messages = []
        for msg in messages:
            if isinstance(msg, dict):
                serialized_messages.append(msg)
            elif hasattr(msg, "model_dump"):
                serialized_messages.append(msg.model_dump(exclude_none=True))
            elif hasattr(msg, "dict"):
                serialized_messages.append(msg.dict(exclude_none=True))
            else:
                serialized_messages.append({"content": str(msg)})

        llm_call.request_messages = serialized_messages

        for msg in serialized_messages:
            if msg.get("role") == "system":
                llm_call.request_system_prompt = msg.get("content")
                break
        
        llm_call.request_tools = kwargs.get("tools", [])
        llm_call.request_temperature = kwargs.get("temperature")
        llm_call.request_max_tokens = kwargs.get("max_tokens")
        llm_call.streaming = kwargs.get("stream", False)
        
        return llm_call
    
    def _record_response(self, llm_call: LLMCall, response: Any) -> None:
        llm_call.complete()
        
        try:
            choice = response.choices[0]
            message = choice.message
            
            llm_call.response_content = message.content
            llm_call.response_finish_reason = choice.finish_reason
            
            if hasattr(message, 'tool_calls') and message.tool_calls:
                for tc in message.tool_calls:
                    tool_call = ToolCallRequest(
                        tool_call_id=tc.id,
                        tool_name=tc.function.name,
                        arguments_raw=tc.function.arguments,
                    )
                    try:
                        tool_call.arguments_parsed = json.loads(tc.function.arguments)
                    except json.JSONDecodeError:
                        pass
                    llm_call.response_tool_calls.append(tool_call)
                # Track this as the last LLM call with tools for linking tool executions
                set_last_llm_call_with_tools(llm_call)
            
            if hasattr(response, 'usage') and response.usage:
                llm_call.usage = TokenUsage(
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    total_tokens=response.usage.total_tokens,
                )
        except (AttributeError, IndexError):
            pass
        
        record_llm_call(llm_call)

class TracedOpenAIChat:
    def __init__(self, original_chat, provider: str = "openai"):
        self._original = original_chat
        self._provider = provider
        self._completions = None
    
    @property
    def completions(self) -> TracedOpenAICompletions:
        if self._completions is None:
            self._completions = TracedOpenAICompletions(
                self._original.completions, self._provider
            )
        return self._completions

class TracedOpenAIClient:
    def __init__(self, original_client, provider: str = "openai"):
        self._original = original_client
        self._provider = provider
        self._chat = None
    
    @property
    def chat(self) -> TracedOpenAIChat:
        if self._chat is None:
            self._chat = TracedOpenAIChat(self._original.chat, self._provider)
        return self._chat
    
    def __getattr__(self, name: str) -> Any:
        return getattr(self._original, name)

def traced_client(client: Any, provider: str = None) -> Any:
    client_type = type(client).__name__
    client_module = type(client).__module__
    
    if "openai" in client_module.lower() or client_type in ("OpenAI"):
        return TracedOpenAIClient(client, provider or "openai")
    
    import warnings
    warnings.warn(f"Unknown client type: {client_type}. Returning unwrapped.")
    return client