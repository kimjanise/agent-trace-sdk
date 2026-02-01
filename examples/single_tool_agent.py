from agent_trace import tool, agent, llm
from openai import OpenAI
import json

client = OpenAI()


@tool
def get_weather(location: str) -> dict:
    return {"location": location, "temperature": 72, "conditions": "sunny"}


@llm(provider="openai", model="gpt-4o")
def call_openai(messages: list, tools: list = None):
    kwargs = {"model": "gpt-4o", "messages": messages}
    if tools:
        kwargs["tools"] = tools
    return client.chat.completions.create(**kwargs)


@agent
def single_tool_agent(query: str) -> str:
    messages = [{"role": "user", "content": query}]

    response = call_openai(
        messages=messages,
        tools=[{"type": "function", "function": get_weather.schema}],
    )

    message = response.choices[0].message

    if message.tool_calls:
                messages.append({
            "role": "assistant",
            "content": message.content,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                }
                for tc in message.tool_calls
            ]
        })

        for tool_call in message.tool_calls:
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)

            if function_name == "get_weather":
                result = get_weather(**arguments)
                messages.append({
                    "role": "tool",
                    "name": function_name,
                    "content": json.dumps(result),
                    "tool_call_id": tool_call.id
                })

        final_response = call_openai(messages=messages)
        return final_response.choices[0].message.content

    return message.content


if __name__ == "__main__":
    result = single_tool_agent("What's the weather in San Francisco?")
    print(result)
