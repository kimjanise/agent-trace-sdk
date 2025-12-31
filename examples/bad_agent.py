from agent_trace import tool, agent, traced_client
from openai import OpenAI
import json

@tool
def get_weather(location: str) -> dict:
    return {"location": location, "temperature": 72, "conditions": "sunny"}

@tool
def get_stock_price(symbol: str) -> dict:
    """Get the current stock price for a given symbol."""
    # This tool intentionally fails to test error handling
    raise ValueError(f"Failed to fetch stock price: API rate limit exceeded for symbol '{symbol}'")

@tool
def get_date(location: str) -> dict:
    return {"day": 17, "month": 5, "year": 2004}

sample_client = OpenAI()
client = traced_client(sample_client)

@agent
def bad_agent(query: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": query}],
        tools=[
            {"type": "function", "function": get_weather.schema},
            {"type": "function", "function": get_stock_price.schema},
            {"type": "function", "function": get_date.schema}
        ],
    )

    message = response.choices[0].message
    messages = [{"role": "user", "content": query}]

    if message.tool_calls:
        messages.append(message)

        for tool_call in message.tool_calls:
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)

            try:
                if function_name == "get_weather":
                    result = get_weather(**arguments)
                elif function_name == "get_stock_price":
                    result = get_stock_price(**arguments)
                elif function_name == "get_date":
                    result = get_date(**arguments)
                else:
                    result = {"error": f"Unknown function: {function_name}"}

                messages.append({
                    "role": "tool",
                    "name": function_name,
                    "content": json.dumps(result),
                    "tool_call_id": tool_call.id
                })
            except Exception as e:
                # Tool failed - append error message
                messages.append({
                    "role": "tool",
                    "name": function_name,
                    "content": json.dumps({"error": str(e)}),
                    "tool_call_id": tool_call.id
                })

        # Get final response after tool calls
        final_response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
        )
        return final_response.choices[0].message.content

    return response.choices[0].message.content

if __name__ == "__main__":
    # This query will trigger the failing get_stock_price tool
    result = bad_agent("What's the current stock price of AAPL and what's the weather in New York?")

    print(f"Result: {result}\n")

    trace = bad_agent.last_trace
    print(f"Trace ID: {trace.trace_id}")
    print(f"Duration: {trace.duration_ms}ms")
    print(f"LLM Calls: {trace.total_llm_calls}")
    print(f"Tool Executions: {trace.total_tool_executions}")
    print(f"\n{trace.to_json()}")
