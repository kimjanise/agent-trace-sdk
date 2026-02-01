"""
Parallel Agent Example - Tests parallel-aware graph visualization.

This agent orchestrates multiple tools to run in parallel using asyncio.gather,
which creates overlapping execution times that the trace UI should display
as parallel branches in the sequential graph view.

Workflow:
1. Agent receives a research query
2. LLM decides to gather data from multiple sources in parallel
3. Tools execute concurrently (overlapping timestamps)
4. Results are aggregated and summarized

Run: python examples/parallel_agent.py
"""

import asyncio
import json
import random
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent_trace import tool, agent, llm
from openai import AsyncOpenAI

client = AsyncOpenAI()


@tool
async def fetch_stock_price(symbol: str) -> dict:
    """Fetch current stock price for a given symbol."""
    await asyncio.sleep(random.uniform(0.2, 0.5))

    prices = {
        "AAPL": 178.50,
        "GOOGL": 141.25,
        "MSFT": 378.90,
        "AMZN": 178.75,
        "NVDA": 875.30,
        "META": 505.15,
    }
    price = prices.get(symbol, random.uniform(50, 500))
    return {
        "symbol": symbol,
        "price": round(price, 2),
        "currency": "USD",
        "timestamp": "2024-01-15T10:30:00Z"
    }


@tool
async def fetch_company_news(company: str) -> dict:
    """Fetch recent news headlines for a company."""
    await asyncio.sleep(random.uniform(0.3, 0.6))

    news_templates = [
        f"{company} announces Q4 earnings beat",
        f"{company} expands into new markets",
        f"Analysts upgrade {company} stock rating",
        f"{company} launches new product line",
    ]
    return {
        "company": company,
        "headlines": random.sample(news_templates, k=2),
        "source": "Financial News API"
    }


@tool
async def fetch_market_sentiment(sector: str) -> dict:
    """Fetch market sentiment analysis for a sector."""
    await asyncio.sleep(random.uniform(0.25, 0.45))

    sentiments = ["bullish", "bearish", "neutral"]
    return {
        "sector": sector,
        "sentiment": random.choice(sentiments),
        "confidence": round(random.uniform(0.6, 0.95), 2),
        "volume_trend": random.choice(["increasing", "decreasing", "stable"])
    }


@tool
async def fetch_analyst_ratings(symbol: str) -> dict:
    """Fetch analyst ratings and price targets."""
    await asyncio.sleep(random.uniform(0.2, 0.4))

    ratings = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"]
    return {
        "symbol": symbol,
        "consensus_rating": random.choice(ratings[:3]),
        "price_target": round(random.uniform(150, 250), 2),
        "num_analysts": random.randint(10, 30)
    }


@tool
async def calculate_portfolio_metrics(symbols_csv: str) -> dict:
    """Calculate aggregate portfolio metrics. Pass symbols as comma-separated string."""
    await asyncio.sleep(random.uniform(0.1, 0.2))

    symbols = [s.strip() for s in symbols_csv.split(",")]
    return {
        "symbols": symbols,
        "diversification_score": round(random.uniform(0.5, 0.9), 2),
        "risk_level": random.choice(["low", "medium", "high"]),
        "estimated_return": f"{random.uniform(5, 15):.1f}%"
    }


tools = [
    {"type": "function", "function": fetch_stock_price.schema},
    {"type": "function", "function": fetch_company_news.schema},
    {"type": "function", "function": fetch_market_sentiment.schema},
    {"type": "function", "function": fetch_analyst_ratings.schema},
    {"type": "function", "function": calculate_portfolio_metrics.schema},
]

tool_map = {
    "fetch_stock_price": fetch_stock_price,
    "fetch_company_news": fetch_company_news,
    "fetch_market_sentiment": fetch_market_sentiment,
    "fetch_analyst_ratings": fetch_analyst_ratings,
    "calculate_portfolio_metrics": calculate_portfolio_metrics,
}


@llm(provider="openai", model="gpt-4o")
async def call_openai(messages: list, tools: list = None, parallel_tool_calls: bool = False):
    kwargs = {"model": "gpt-4o", "messages": messages}
    if tools:
        kwargs["tools"] = tools
        kwargs["parallel_tool_calls"] = parallel_tool_calls
    return await client.chat.completions.create(**kwargs)


@agent
async def parallel_research_agent(query: str) -> str:
    """
    An agent that researches stocks by fetching data from multiple sources in parallel.

    The key difference from sequential agents: when the LLM requests multiple tool calls,
    we execute them concurrently using asyncio.gather instead of one-by-one.
    """
    messages = [
        {
            "role": "system",
            "content": """You are a financial research assistant. When analyzing stocks,
            you should gather data from multiple sources simultaneously for efficiency.

            For any stock analysis request, always call multiple tools in a single response:
            - fetch_stock_price for current prices
            - fetch_company_news for recent news
            - fetch_analyst_ratings for analyst opinions
            - fetch_market_sentiment for sector trends

            After gathering all data, provide a comprehensive analysis."""
        },
        {"role": "user", "content": query}
    ]

    max_turns = 5
    turn = 0

    while turn < max_turns:
        turn += 1

        response = await call_openai(
            messages=messages,
            tools=tools,
            parallel_tool_calls=True,
        )

        message = response.choices[0].message

        if not message.tool_calls:
            return message.content

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

        async def execute_tool(tool_call):
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)

            if function_name in tool_map:
                try:
                    result = await tool_map[function_name](**arguments)
                except Exception as e:
                    result = {"error": str(e)}
            else:
                result = {"error": f"Unknown function: {function_name}"}

            return {
                "role": "tool",
                "name": function_name,
                "content": json.dumps(result),
                "tool_call_id": tool_call.id
            }

        tool_results = await asyncio.gather(
            *[execute_tool(tc) for tc in message.tool_calls]
        )

        messages.extend(tool_results)

    final_response = await call_openai(messages=messages)
    return final_response.choices[0].message.content


@agent
async def sequential_research_agent(query: str) -> str:
    """
    A comparison agent that executes tools sequentially (one after another).
    Use this to compare against the parallel agent in the trace UI.
    """
    messages = [
        {
            "role": "system",
            "content": """You are a financial research assistant. Analyze stocks by gathering data
            from multiple sources. Call tools one at a time to gather information."""
        },
        {"role": "user", "content": query}
    ]

    max_turns = 5
    turn = 0

    while turn < max_turns:
        turn += 1

        response = await call_openai(messages=messages, tools=tools)
        message = response.choices[0].message

        if not message.tool_calls:
            return message.content

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

            if function_name in tool_map:
                try:
                    result = await tool_map[function_name](**arguments)
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

    final_response = await call_openai(messages=messages)
    return final_response.choices[0].message.content


async def main():
    query = """Analyze AAPL and NVDA stocks for me. I want to understand:
    1. Current stock prices for both
    2. Recent news for both companies
    3. Analyst ratings for both
    4. Tech sector sentiment

    Give me a comprehensive analysis with your recommendation."""

    print("=" * 60)
    print("PARALLEL AGENT (tools execute concurrently)")
    print("=" * 60)

    import time
    start = time.time()
    result = await parallel_research_agent(query)
    parallel_time = time.time() - start

    print(f"\nResult:\n{result}")
    print(f"\nExecution time: {parallel_time:.2f}s")

    print("\n" + "=" * 60)
    print("SEQUENTIAL AGENT (tools execute one-by-one)")
    print("=" * 60)

    start = time.time()
    result = await sequential_research_agent(query)
    sequential_time = time.time() - start

    print(f"\nResult:\n{result}")
    print(f"\nExecution time: {sequential_time:.2f}s")

    print("\n" + "=" * 60)
    print(f"COMPARISON: Parallel={parallel_time:.2f}s vs Sequential={sequential_time:.2f}s")
    print(f"Speedup: {sequential_time/parallel_time:.1f}x faster with parallel execution")
    print("=" * 60)
    print("\nCheck the trace UI to see:")
    print("- Parallel agent: Tools should appear as parallel branches (fork-join pattern)")
    print("- Sequential agent: Tools should appear in a linear chain")


if __name__ == "__main__":
    asyncio.run(main())
