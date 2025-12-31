from agent_trace import tool, agent, traced_client
from openai import OpenAI
import json

@tool
def get_weather(location: str) -> dict:
    weather_data = {
        "San Francisco": {"temperature": 65, "conditions": "foggy", "humidity": 80},
        "New York": {"temperature": 45, "conditions": "cloudy", "humidity": 60},
        "Los Angeles": {"temperature": 75, "conditions": "sunny", "humidity": 40},
        "Chicago": {"temperature": 35, "conditions": "windy", "humidity": 55},
    }
    data = weather_data.get(location, {"temperature": 70, "conditions": "unknown", "humidity": 50})
    return {"location": location, **data}

@tool
def get_population(city: str) -> dict:
    populations = {
        "San Francisco": 874961,
        "New York": 8336817,
        "Los Angeles": 3979576,
        "Chicago": 2693976,
    }
    return {"city": city, "population": populations.get(city, "unknown")}

@tool
def compare_cities(city1: str, city2: str, metric: str) -> dict:
    return {
        "comparison": f"Comparing {city1} vs {city2} on {metric}",
        "city1": city1,
        "city2": city2,
        "metric": metric,
        "result": f"{city1} and {city2} have been compared on {metric}"
    }

@tool
def get_recommendation(criteria: str) -> dict:
    recommendations = {
        "weather": "Los Angeles - best sunny weather",
        "population": "New York - largest city",
        "tech": "San Francisco - tech hub",
        "food": "Chicago - great food scene",
    }
    return {
        "criteria": criteria,
        "recommendation": recommendations.get(criteria.lower(), "San Francisco - great all-around city")
    }

sample_client = OpenAI()
client = traced_client(sample_client)

tools = [
    {"type": "function", "function": get_weather.schema},
    {"type": "function", "function": get_population.schema},
    {"type": "function", "function": compare_cities.schema},
    {"type": "function", "function": get_recommendation.schema},
]

tool_map = {
    "get_weather": get_weather,
    "get_population": get_population,
    "compare_cities": compare_cities,
    "get_recommendation": get_recommendation,
}

@agent
def multi_tool_agent(query: str) -> str:
    messages = [{"role": "user", "content": query}]

    max_turns = 5
    turn = 0

    while turn < max_turns:
        turn += 1

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
        )

        message = response.choices[0].message

        if not message.tool_calls:
            return message.content

        messages.append(message)

        for tool_call in message.tool_calls:
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)

            if function_name in tool_map:
                try:
                    result = tool_map[function_name](**arguments)
                except Exception as e:
                    result = {"error": str(e)}
            else:
                result = {"error": f"Unknown function: {function_name}"}

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
    query = """I'm trying to decide where to move. Can you help me compare San Francisco and New York?
    I want to know:
    1. The weather in both cities
    2. The population of both cities
    3. A comparison of the two cities on livability
    4. Your final recommendation based on tech jobs

    Please gather all this information and give me a comprehensive answer."""
    result = multi_tool_agent(query)
