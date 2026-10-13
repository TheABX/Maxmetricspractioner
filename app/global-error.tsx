"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#f4efe6", color: "#17202a", fontFamily: "Georgia, serif" }}>
        <div style={{ maxWidth: 512, margin: "20vh auto", padding: 24 }}>
          <p style={{ letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 12 }}>MAXMetrics</p>
          <h1 style={{ fontSize: 36, marginTop: 12 }}>Clinic could not load</h1>
          <p style={{ color: "#5c6770", marginTop: 12 }}>
            Open sign in and try again. If this keeps happening, confirm the Vercel Supabase
            environment variables and redeploy.
          </p>
          <p style={{ marginTop: 24 }}>
            <a href="/login" style={{ color: "#1f4d3a" }}>
              Go to sign in
            </a>
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              background: "#1f4d3a",
              color: "white",
              border: 0,
              borderRadius: 6,
              padding: "8px 16px",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
