require("dotenv").config();
const app = require("./app");
const { connectDB } = require("./config/db");

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
    await connectDB(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/petprint");
    app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error("Failed to start:", err.message);
    process.exit(1);
  }
})();
