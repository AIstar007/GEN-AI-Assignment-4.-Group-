import re
import json
import os
import logging
import sqlite3
import random
from typing import TypedDict, Any, Dict, List

from dotenv import load_dotenv
from langchain_community.utilities import SQLDatabase
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq

# ============================================================
# Setup
# ============================================================
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sql-chart-api")

# Connect to SQLite file
db_path = "northwind.db"
db = SQLDatabase.from_uri(
    f"sqlite:///{db_path}",
    sample_rows_in_table_info=0
)

# LLM setup
llm = ChatGroq(
    model="gemma2-9b-it",
    api_key=os.getenv("GROQ_API_KEY")
)

# ============================================================
# State Structure
# ============================================================
class ChatState(TypedDict):
    query: str
    sql: str
    result: Any
    answer: str
    chart_type: str
    chart_config: Dict

# ============================================================
# Utility
# ============================================================
def random_color(alpha: float = 0.7) -> str:
    """Generate random RGBA color string."""
    return f"rgba({random.randint(0,255)}, {random.randint(0,255)}, {random.randint(0,255)}, {alpha})"

# ============================================================
# Nodes
# ============================================================
def generate_sql(state: dict) -> dict:
    """Generate SQL query from natural language."""
    schema = db.get_table_info()
    prompt = f"""
    You are an expert SQL assistant. Generate a valid SQLite query
    for the following schema:

    {schema}

    Notes:
    - Use exact table names, **with quotes** if they contain spaces (like "Order Details").
    - Always use table aliases consistently.
    - Return SQL only (no explanation, no markdown fences).

    Question: {state["query"]}
    """

    response = llm.invoke(prompt)
    sql = response.content.strip()

    # cleanup
    sql = re.sub(r"^```sql", "", sql, flags=re.IGNORECASE).strip()
    sql = re.sub(r"```$", "", sql).strip()

    state["sql"] = sql
    logger.info(f"📝 Generated SQL: {sql}")
    return state


def execute_sql(state: dict) -> dict:
    """Run the generated SQL against the database."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(state["sql"])
        rows = cursor.fetchall()
        cols = [desc[0] for desc in cursor.description]
        conn.close()

        # convert tuples → dicts
        result: List[Dict[str, Any]] = [dict(zip(cols, row)) for row in rows]
        state["result"] = result
        logger.info(f"✅ Query returned {len(result)} rows")

    except Exception as e:
        logger.error(f"❌ SQL Execution Error: {e}")
        state["result"] = []
        state["answer"] = f"SQL Execution Error: {str(e)}"

    return state


def generate_chart_config(state: dict) -> dict:
    """Suggest best chart config for the result and add random colors."""
    prompt = f"""
    You are a data visualization assistant.
    Based on the SQL query result below, suggest the best chart type and config.

    Question: {state["query"]}
    SQL: {state["sql"]}
    Result: {state["result"]}

    Rules:
    - Choose chart_type from: ["bar", "line", "pie", "table"].
    - Output JSON only with keys: chart_type, chart_config.
    - chart_config must have "labels" and "datasets" compatible with Chart.js.
    """

    response = llm.invoke(prompt)
    raw = response.content.strip()

    # extract JSON safely
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        logger.error(f"⚠️ Invalid chart config response: {raw}")
        state["chart_type"] = "table"
        state["chart_config"] = {"labels": [], "datasets": []}
        return state

    try:
        parsed = json.loads(match.group(0))
        chart_type = parsed.get("chart_type", "table")
        chart_config = parsed.get("chart_config", {"labels": [], "datasets": []})

        labels = chart_config.get("labels", [])
        datasets = chart_config.get("datasets", [])

        if datasets:
            for ds in datasets:
                if chart_type in ["bar", "pie"] and labels:
                    ds["backgroundColor"] = [random_color() for _ in labels]
                elif chart_type == "line":
                    ds["borderColor"] = random_color(1.0)
                    ds["backgroundColor"] = random_color(0.2)

            logger.info(f"🎨 Applied random colors for {chart_type} chart")

        state["chart_type"] = chart_type
        state["chart_config"] = chart_config

    except json.JSONDecodeError as e:
        logger.error(f"⚠️ JSON Parse Error: {e}")
        state["chart_type"] = "table"
        state["chart_config"] = {"labels": [], "datasets": []}

    return state


def generate_answer(state: dict) -> dict:
    """Generate final natural language answer."""
    prompt = f"""
    The SQL query executed successfully.

    Question: {state["query"]}
    SQL: {state["sql"]}
    Result: {state["result"]}

    Please provide a clear, concise answer to the user based on the result.
    """
    response = llm.invoke(prompt)
    state["answer"] = response.content.strip()
    return state


def add_forecast_with_arima(state: dict) -> dict:
    """(Optional) Add ARIMA forecast for time series queries."""
    try:
        import pandas as pd
        from statsmodels.tsa.arima.model import ARIMA

        result = state.get("result", [])
        if not result or not isinstance(result, list):
            return state

        # Must contain both "period" and "value"
        if not all(key in result[0] for key in ["period", "value"]):
            return state

        df = pd.DataFrame(result)
        df["period"] = pd.to_datetime(df["period"], errors="coerce")
        df = df.dropna()

        if df.empty:
            return state

        model = ARIMA(df["value"], order=(2, 1, 2))
        fitted = model.fit()
        forecast = fitted.forecast(steps=6)  # predict 6 future periods

        state["chart_config"].setdefault("datasets", []).append({
            "label": "Forecast",
            "data": forecast.tolist(),
            "borderColor": "rgba(255,0,0,1)",
            "backgroundColor": "rgba(255,0,0,0.3)"
        })
        logger.info("📈 ARIMA forecast added")

    except Exception as e:
        logger.warning(f"⚠️ ARIMA forecast skipped: {e}")

    return state

# ============================================================
# Graph Construction
# ============================================================
graph = StateGraph(ChatState)

graph.add_node("generate_sql", generate_sql)
graph.add_node("execute_sql", execute_sql)
graph.add_node("generate_chart_config", generate_chart_config)
graph.add_node("generate_answer", generate_answer)
graph.add_node("add_forecast_with_arima", add_forecast_with_arima)

graph.set_entry_point("generate_sql")
graph.add_edge("generate_sql", "execute_sql")
graph.add_edge("execute_sql", "generate_chart_config")
graph.add_edge("generate_chart_config", "add_forecast_with_arima")
graph.add_edge("add_forecast_with_arima", "generate_answer")
graph.add_edge("generate_answer", END)

app_graph = graph.compile()

# ============================================================
# Debug Run
# ============================================================
if __name__ == "__main__":
    user_input = {"query": "Show me total sales per category"}
    final_state = app_graph.invoke(user_input)
    print(json.dumps(final_state, indent=2))