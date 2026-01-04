from agent_trace import tool, agent, traced_client
from openai import OpenAI
import json

@tool
def get_weather(location: str) -> dict:
    return {"location": location, "temperature": 72, "conditions": "sunny"}

sample_client = OpenAI();
client = traced_client(sample_client)

@agent
def single_tool_agent(query: str) -> str:    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": query}],
        tools=[{"type": "function", "function": get_weather.schema}, {"type": "function", "function": get_date.schema}],
    )
    
    message = response.choices[0].message
    messages = [{"role": "user", "content": query}]
    
    if message.tool_calls:
        messages.append(message)

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
            elif function_name == "get_date":
                result = get_date(**arguments)
                messages.append({
                    "role": "tool",
                    "name": function_name,
                    "content": json.dumps(result),
                    "tool_call_id": tool_call.id
                })
    
    final_response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )

    return final_response.choices[0].message.content

if __name__ == "__main__":
    result = single_tool_agent("What's the weather in San Francisco?")
