from agent_trace import tool, agent, llm
from openai import OpenAI
import json

client = OpenAI()


@tool
def search_flights(origin: str, destination: str) -> dict:
    flights = [
        {"flight_id": "FL123", "airline": "United", "price": 450, "departure": "8:00 AM"},
        {"flight_id": "FL456", "airline": "Delta", "price": 520, "departure": "2:00 PM"},
        {"flight_id": "FL789", "airline": "American", "price": 380, "departure": "6:00 PM"},
    ]
    return {
        "origin": origin,
        "destination": destination,
        "available_flights": flights,
        "note": "Use get_flight_details with a flight_id to see more info before booking"
    }


@tool
def get_flight_details(flight_id: str) -> dict:
    details = {
        "FL123": {"flight_id": "FL123", "airline": "United", "aircraft": "Boeing 737", "duration": "5h 30m", "stops": 0, "meals": "snacks", "wifi": True, "seats_available": 23},
        "FL456": {"flight_id": "FL456", "airline": "Delta", "aircraft": "Airbus A320", "duration": "5h 45m", "stops": 1, "meals": "full meal", "wifi": True, "seats_available": 8},
        "FL789": {"flight_id": "FL789", "airline": "American", "aircraft": "Boeing 757", "duration": "5h 15m", "stops": 0, "meals": "snacks", "wifi": False, "seats_available": 45},
    }
    if flight_id not in details:
        return {"error": f"Flight {flight_id} not found"}
    return details[flight_id]


@tool
def check_seat_availability(flight_id: str, seat_class: str) -> dict:
    availability = {
        "FL123": {"economy": 20, "business": 3, "first": 0},
        "FL456": {"economy": 5, "business": 2, "first": 1},
        "FL789": {"economy": 40, "business": 4, "first": 1},
    }
    if flight_id not in availability:
        return {"error": f"Flight {flight_id} not found"}
    seats = availability[flight_id].get(seat_class.lower(), 0)
    return {
        "flight_id": flight_id,
        "seat_class": seat_class,
        "available_seats": seats,
        "can_book": seats > 0
    }


@tool
def book_flight(flight_id: str, seat_class: str, passenger_name: str) -> dict:
    return {
        "confirmation_code": f"CONF-{flight_id}-{passenger_name[:3].upper()}",
        "flight_id": flight_id,
        "seat_class": seat_class,
        "passenger": passenger_name,
        "status": "CONFIRMED",
        "message": f"Successfully booked {seat_class} seat on flight {flight_id} for {passenger_name}"
    }


tools = [
    {"type": "function", "function": search_flights.schema},
    {"type": "function", "function": get_flight_details.schema},
    {"type": "function", "function": check_seat_availability.schema},
    {"type": "function", "function": book_flight.schema},
]

tool_map = {
    "search_flights": search_flights,
    "get_flight_details": get_flight_details,
    "check_seat_availability": check_seat_availability,
    "book_flight": book_flight,
}

SYSTEM_PROMPT = """You are a flight booking assistant. You MUST follow this exact process:

1. FIRST: Search for flights using search_flights
2. SECOND: After getting search results, use get_flight_details on the cheapest option to verify details
3. THIRD: Use check_seat_availability to confirm seats are available in the requested class
4. FOURTH: Only after confirming availability, use book_flight to complete the booking

You MUST make these calls in separate steps - do not try to do everything at once.
Each step depends on information from the previous step."""


@llm(provider="openai", model="gpt-4o")
def call_openai(messages: list, tools: list = None):
    kwargs = {"model": "gpt-4o", "messages": messages}
    if tools:
        kwargs["tools"] = tools
    return client.chat.completions.create(**kwargs)


@agent
def multi_turn_agent(query: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query}
    ]

    max_turns = 10
    turn = 0

    while turn < max_turns:
        turn += 1

        response = call_openai(messages=messages, tools=tools)
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

    final_response = call_openai(messages=messages)
    return final_response.choices[0].message.content


if __name__ == "__main__":
    query = """I need to book a business class flight from San Francisco to New York for John Smith.
    Find me the cheapest option, verify the details, check business class availability, and book it."""

    result = multi_turn_agent(query)
    print(result)
