"use client";

/**
 * Catches runtime errors (e.g. ChunkLoadError when a JS chunk fails to load).
 * Asking the user to refresh usually fixes stale chunk / cache issues.
 */
export default function GlobalError({ error, reset }) {
  const isChunkError =
    error?.name === "ChunkLoadError" ||
    error?.message?.includes("Loading chunk") ||
    error?.message?.includes("ChunkLoadError");

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "480px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
          Something went wrong
        </h1>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          {isChunkError
            ? "A script failed to load. This often happens after an update or when the browser cache is stale."
            : "An unexpected error occurred."}
        </p>
        <p style={{ marginBottom: "1rem" }}>
          Try refreshing the page. If the problem continues, close all tabs for this app and open it again.
        </p>
        <button
          type="button"
          onClick={() => window.location.href = "/"}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: "pointer",
            backgroundColor: "#1890ff",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          Go to home
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginLeft: "0.5rem",
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: "pointer",
            backgroundColor: "#f0f0f0",
            border: "1px solid #d9d9d9",
            borderRadius: "4px",
          }}
        >
          Refresh page
        </button>
      </body>
    </html>
  );
}
