from fastapi import FastAPI
from pydantic import BaseModel, Field
from test import app_graph
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
import logging
from typing import List, Dict, Any

# ======================================================
# FastAPI Initialization
# ======================================================
app = FastAPI(
    title="SQL Chart Visualization API",
    version="1.2.0",
    description="""
    🚀 API that converts **natural language queries** into:
    - ✅ SQL queries
    - ✅ Chart configurations
    - ✅ Tabular results
    
    Use the `/ask` endpoint to send queries.
    """,
    docs_url="/docs",   # Swagger UI
    redoc_url=None,     # Disable default Redoc (custom version below)
)

# ======================================================
# Logging Setup
# ======================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("sql-chart-api")

# ======================================================
# CORS Setup
# ======================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================================================
# Models
# ======================================================
class QueryRequest(BaseModel):
    """Incoming query payload."""
    query: str = Field(..., example="Show me total sales per category")

class QueryResponse(BaseModel):
    """Response with SQL + chart data."""
    answer: str
    chart_type: str
    chart_config: Dict[str, Any]
    sql: str
    result: List[Dict[str, Any]]

class ErrorResponse(BaseModel):
    """Standardized error response."""
    error: str
    detail: str

# ======================================================
# Endpoints
# ======================================================
@app.post(
    "/ask",
    response_model=QueryResponse,
    responses={500: {"model": ErrorResponse}},
    tags=["Query"]
)
async def ask(request: QueryRequest):
    """
    Convert natural language queries into:
    - SQL
    - Chart configuration
    - Tabular result
    """
    try:
        logger.info(f"📩 Received query: {request.query}")

        final_state = app_graph.invoke({"query": request.query})

        sql = final_state.get("sql", "")
        result = final_state.get("result", [])
        answer = final_state.get("answer", "No answer generated")

        # ✅ Ensure result is always a list of dicts
        if not isinstance(result, list):
            logger.warning("⚠️ Invalid result format, coercing to empty list")
            result = []

        logger.info(f"📝 Generated SQL: {sql}")
        logger.info(f"📊 Rows returned: {len(result)}")

        return {
            "answer": answer,
            "chart_type": final_state.get("chart_type", "bar"),
            "chart_config": final_state.get("chart_config", {}),
            "sql": sql,
            "result": result,
        }

    except Exception as e:
        logger.error(f"❌ Error processing query: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error", "detail": str(e)},
        )

@app.get("/health", tags=["System"])
async def health_check():
    """Simple health check."""
    return {"status": "healthy"}

# ======================================================
# Custom Redoc (with Dark Mode Toggle)
# ======================================================
@app.get("/redoc", include_in_schema=False)
async def custom_redoc():
    """Custom ReDoc UI with Dark Mode toggle + branding."""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
      <title>API Docs - SQL Chart Visualization</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: system-ui, sans-serif;
          transition: background-color 0.3s, color 0.3s;
        }
        #theme-toggle {
          position: fixed;
          top: 10px;
          right: 10px;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          background: #333;
          color: white;
          font-weight: bold;
          z-index: 1000;
        }
        body.light-mode #theme-toggle {
          background: #eee;
          color: black;
        }
        body.dark-mode {
          background: #121212;
          color: #f5f5f5;
        }
      </style>
    </head>
    <body>
      <button id="theme-toggle">🌙 Dark Mode</button>
      <redoc spec-url='/openapi.json'></redoc>
      <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
      <script>
        const body = document.body;
        const btn = document.getElementById("theme-toggle");

        function applyTheme(isDark) {
          if (isDark) {
            body.classList.add("dark-mode");
            body.classList.remove("light-mode");
            btn.textContent = "☀️ Light Mode";
          } else {
            body.classList.remove("dark-mode");
            body.classList.add("light-mode");
            btn.textContent = "🌙 Dark Mode";
          }
        }

        const savedTheme = localStorage.getItem("appTheme") === "dark";
        applyTheme(savedTheme);

        btn.addEventListener("click", () => {
          const isDark = !body.classList.contains("dark-mode");
          applyTheme(isDark);
          localStorage.setItem("appTheme", isDark ? "dark" : "light");
        });
      </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)