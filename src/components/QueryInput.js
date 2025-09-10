import React, { useState } from "react";

const QueryInput = ({ onSubmit, initialQuery, loading, isDarkMode }) => {
  const [query, setQuery] = useState(initialQuery || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && !loading) {
      onSubmit(query.trim());
    }
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
  };

  // ✅ Support "Enter to submit" and "Shift+Enter for new line"
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const sampleQueries = [
    "Show me total sales per category",
    "List top 10 customers by total orders",
    "What are the monthly sales trends?",
    "Show product sales by region",
    "Display employee performance metrics",
  ];

  const handleSampleQuery = (sampleQuery) => {
    setQuery(sampleQuery);
    if (!loading) {
      onSubmit(sampleQuery);
    }
  };

  return (
    <div
      className={`query-input-container ${
        isDarkMode ? "dark-mode" : ""
      }`}
    >
      <form onSubmit={handleSubmit} className="query-form">
        <div className="input-group">
          <textarea
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter your query here (Shift+Enter for new line, Enter to submit)..."
            className="query-textarea"
            rows={3}
            disabled={loading}
            aria-label="SQL or natural language query input"
          />
          <button
            type="submit"
            className="submit-button"
            disabled={loading || !query.trim()}
          >
            {loading ? "Processing..." : "Submit Query"}
          </button>
        </div>
      </form>

      <div className="sample-queries">
        <h3>Sample Queries:</h3>
        <div className="sample-buttons">
          {sampleQueries.map((sampleQuery, index) => (
            <button
              key={index}
              onClick={() => handleSampleQuery(sampleQuery)}
              className="sample-button"
              disabled={loading}
              aria-label={`Run sample query: ${sampleQuery}`}
            >
              {sampleQuery}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QueryInput;