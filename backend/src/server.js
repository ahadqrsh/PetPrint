require("dotenv").config();
const app = require("./app");
const { connectDB } = require("./config/db");

const PORT = process.env.PORT || 5000;
// Render (and most hosts) require binding to 0.0.0.0, not localhost.
const HOST = process.env.HOST || "0.0.0.0";

/**
 * Fail loudly at boot rather than quietly at the first request. A missing
 * MONGODB_URI in production would otherwise fall back to a local database
 * that doesn't exist, and every request would time out mysteriously.
 */
function checkEnvironment() {
  const isProduction = process.env.NODE_ENV === "production";
  const problems = [];

  if (!process.env.JWT_SECRET) {
    problems.push("JWT_SECRET is not set.");
  } else if (process.env.JWT_SECRET.length < 32) {
    problems.push(
      `JWT_SECRET is only ${process.env.JWT_SECRET.length} characters. ` +
      "Use at least 32 — generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
    );
  } else if (/^(change-?me|secret|test|dev|password)/i.test(process.env.JWT_SECRET)) {
    problems.push("JWT_SECRET still looks like a placeholder. Generate a real one.");
  }

  if (isProduction) {
    if (!process.env.MONGODB_URI) {
      problems.push("MONGODB_URI is not set (there is no local database in production).");
    }
    if (!process.env.CLIENT_ORIGIN) {
      problems.push("CLIENT_ORIGIN is not set, so CORS will block your frontend.");
    }
  }

  if (problems.length) {
    console.error("\nCannot start:\n" + problems.map((p) => `  · ${p}`).join("\n") + "\n");
    process.exit(1);
  }
}

(async () => {
  try {
    checkEnvironment();
    await connectDB(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/petprint");
    app.listen(PORT, HOST, () => {
      console.log(`[api] listening on ${HOST}:${PORT} (${process.env.NODE_ENV || "development"})`);
    });
  } catch (err) {
    console.error("Failed to start:", err.message);
    process.exit(1);
  }
})();

// Render sends SIGTERM on redeploy; close cleanly so in-flight requests finish.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log(`[api] ${signal} received, shutting down`);
    process.exit(0);
  });
}
