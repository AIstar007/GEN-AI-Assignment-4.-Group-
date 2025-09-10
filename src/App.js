import React, { useState, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown"; // ✅ Added for proper markdown rendering
import ChartComponent from "./components/ChartComponent";
import "./App.css";

function App() {
  const [conversation, setConversation] = useState(null); // one query + response
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("Show me total sales per category");
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("appTheme") === "dark"
  );

  const fetchData = async (userQuery) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post("/ask", { query: userQuery });
      const data = response.data;

      // 🎨 Randomize chart colors if datasets exist
      if (data.chart_config?.datasets?.length > 0) {
        data.chart_config.datasets = data.chart_config.datasets.map((ds) => ({
          ...ds,
          backgroundColor:
            ds.backgroundColor ||
            data.chart_config.labels.map(
              () => `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`
            ),
        }));
      }

      // Store one user query + one assistant response
      setConversation({
        user: { text: userQuery },
        bot: {
          text: data.answer,
          chartType: data.chart_type,
          chartConfig: data.chart_config || null, // ✅ safe fallback
          sql: data.sql,
          raw: data.result,
        },
      });
    } catch (err) {
      setError("Failed to fetch data: " + err.message);
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load initial query
  useEffect(() => {
    fetchData(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dark mode toggle
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("appTheme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("appTheme", "light");
    }
  }, [darkMode]);

  const handleQuerySubmit = (newQuery) => {
    setQuery(newQuery);
    fetchData(newQuery);
  };

  return (
    <div className={`App ${darkMode ? "dark" : "light"}`}>
      {/* ================= Assistant Header ================= */}
      <div className="chatbot-card">
        <div className="chatbot-header">
          <div className="chatbot-header-icon">🤖</div>
          <div>
            <h2>SQL Chart Visualization Assistant</h2>
            <p>Ask questions and get instant answers with charts, SQL, and raw data.</p>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          className="theme-toggle"
          onClick={() => setDarkMode(!darkMode)}
          aria-label="Toggle dark mode"
        >
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>

        {/* Query Input */}
        <div className="query-input-container">
          <div className="input-group">
            <textarea
              className="query-textarea"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about sales, customers, orders..."
              rows={2}
            />
            <button
              className="submit-button"
              onClick={() => handleQuerySubmit(query)}
              disabled={loading}
            >
              ➤
            </button>
          </div>

          {/* Sample queries */}
          <div className="sample-queries">
            <button
              className="sample-button"
              onClick={() => handleQuerySubmit("Show me total sales per category")}
            >
              Show me total sales per category
            </button>
            <button
              className="sample-button"
              onClick={() =>
                handleQuerySubmit("List top 10 customers by total orders")
              }
            >
              List top 10 customers by total orders
            </button>
            <button
              className="sample-button"
              onClick={() => handleQuerySubmit("What are the monthly sales trends?")}
            >
              What are the monthly sales trends?
            </button>
          </div>
        </div>
      </div>

      {/* ================= Conversation ================= */}
      {error && <div className="error-message">{error}</div>}

      {conversation && (
        <div className="chat-window">
          {/* User Query */}
          <div className="message-card user-card">
            <div className="message-header">
              <span className="message-icon">✍️</span>
              <span className="message-title">Your Query</span>
            </div>
            <div className="message-body">
              <p>{conversation.user.text}</p>
            </div>
          </div>

          {/* Assistant Response */}
          <div className="message-card bot-card">
            <div className="message-header">
              <span className="message-icon">🤖</span>
              <span className="message-title">Assistant Response</span>
            </div>
            <div className="message-body">
              {/* ✅ Render markdown correctly */}
              <ReactMarkdown>{conversation.bot.text}</ReactMarkdown>
            </div>

            {conversation.bot.chartConfig ? (
              <div className="chart-section">
                <ChartComponent
                  chartType={conversation.bot.chartType}
                  chartConfig={conversation.bot.chartConfig}
                  isDarkMode={darkMode}
                />

                <details>
                  <summary>Show SQL</summary>
                  <pre>
                    <code>{conversation.bot.sql}</code>
                  </pre>
                </details>

                <details>
                  <summary>Show Raw Data</summary>
                  <pre>
                    <code>{JSON.stringify(conversation.bot.raw, null, 2)}</code>
                  </pre>
                </details>
              </div>
            ) : (
              <p>📊 No chart available for this query.</p> // ✅ graceful fallback
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Thinking...</p>
        </div>
      )}
    </div>
  );
}

export default App;