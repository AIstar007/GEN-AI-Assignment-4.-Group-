import React, { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const randomColor = (alpha = 0.6) => {
  const r = Math.floor(Math.random() * 255);
  const g = Math.floor(Math.random() * 255);
  const b = Math.floor(Math.random() * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ChartComponent = ({ chartType, chartConfig, isDarkMode }) => {
  const [showDebug, setShowDebug] = useState(false);

  // ✅ Defensive config cleanup
  const safeChartConfig = useMemo(() => {
    if (!chartConfig || !Array.isArray(chartConfig.datasets)) {
      console.warn("⚠️ Invalid chartConfig:", chartConfig);
      return null;
    }

    const labels = Array.isArray(chartConfig.labels)
      ? chartConfig.labels
      : chartConfig.datasets[0]?.data?.map((_, i) => `Label ${i + 1}`) || [];

    const datasets = chartConfig.datasets
      .filter((ds) => Array.isArray(ds.data) && ds.data.length > 0)
      .map((ds) => {
        const bgColor =
          ds.backgroundColor ||
          (chartType === "line"
            ? randomColor(0.2)
            : labels.map(() => randomColor(0.6)));

        return {
          ...ds,
          label: ds.label || "Series",
          backgroundColor: bgColor,
          borderColor: ds.borderColor || randomColor(1),
        };
      });

    if (datasets.length === 0) {
      console.warn("⚠️ No valid datasets to render");
      return null;
    }

    return { labels, datasets };
  }, [chartConfig, chartType]);

  // ✅ Dynamic options
  const chartOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: {
        position: "top",
        labels: { color: isDarkMode ? "#e2e8f0" : "#333" },
      },
      title: {
        display: true,
        text: "Data Visualization",
        color: isDarkMode ? "#e2e8f0" : "#333",
      },
      tooltip: {
        backgroundColor: isDarkMode ? "#2d3748" : "#fff",
        titleColor: isDarkMode ? "#e2e8f0" : "#000",
        bodyColor: isDarkMode ? "#e2e8f0" : "#000",
      },
    },
    scales:
      chartType !== "pie"
        ? {
            x: {
              ticks: { color: isDarkMode ? "#e2e8f0" : "#333" },
              grid: { color: isDarkMode ? "#444" : "#ddd" },
            },
            y: {
              beginAtZero: true,
              ticks: { color: isDarkMode ? "#e2e8f0" : "#333" },
              grid: { color: isDarkMode ? "#444" : "#ddd" },
            },
          }
        : undefined,
  }), [isDarkMode, chartType]);

  // ✅ Fallback chart
  const defaultChart = (
    <Line
      data={{
        labels: ["A", "B", "C", "D"],
        datasets: [
          {
            label: "Default Data",
            data: [10, 20, 15, 30],
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            fill: true,
          },
        ],
      }}
      options={{
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          title: {
            display: true,
            text: "Default Chart (No Valid Data)",
            color: isDarkMode ? "#e2e8f0" : "#333",
          },
        },
      }}
    />
  );

  // ✅ Table renderer
  const renderTable = () => {
    if (!safeChartConfig) return <div>No table data available</div>;

    const { labels, datasets } = safeChartConfig;

    return (
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              {datasets.map((ds, i) => <th key={i}>{ds.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, rowIndex) => (
              <tr key={rowIndex}>
                <td>{label}</td>
                {datasets.map((ds, colIndex) => (
                  <td key={colIndex}>{ds.data[rowIndex] ?? "N/A"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ✅ Chart renderer
  const renderChart = () => {
    if (!safeChartConfig) return defaultChart;

    switch (chartType) {
      case "bar":
        return <Bar data={safeChartConfig} options={chartOptions} />;
      case "line":
        if (safeChartConfig.datasets.some((ds) =>
          ["History", "Forecast"].includes(ds.label)
        )) {
          const modified = {
            ...safeChartConfig,
            datasets: safeChartConfig.datasets.map((ds) =>
              ds.label === "Forecast"
                ? {
                    ...ds,
                    borderDash: [6, 6],
                    pointRadius: 5,
                    pointBackgroundColor: "red",
                    fill: true,
                    backgroundColor: "rgba(255,99,132,0.2)",
                  }
                : ds
            ),
          };
          return <Line data={modified} options={chartOptions} />;
        }
        return <Line data={safeChartConfig} options={chartOptions} />;
      case "pie":
        return <Pie data={safeChartConfig} options={chartOptions} />;
      case "table":
        return renderTable();
      default:
        return defaultChart;
    }
  };

  return (
    <div className="chart-container">
      {renderChart()}

      {/* 🐞 Debug toggle button */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="debug-toggle"
      >
        {showDebug ? "🙈 Hide Debug" : "🐞 Show Debug"}
      </button>

      {/* Debug panel */}
      {showDebug && (
        <pre className="debug-panel">
          {JSON.stringify(chartConfig, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default ChartComponent;