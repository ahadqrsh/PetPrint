const path = require("path");
const express = require("express");
const cors = require("cors");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const { publicRouter: clinicsPublic, myRouter: clinicMine } = require("./routes/clinicRoutes");
const vetRoutes = require("./routes/vetRoutes");
const petRoutes = require("./routes/petRoutes");
const recordRoutes = require("./routes/recordRoutes");
const searchRoutes = require("./routes/searchRoutes");
const adoptionRoutes = require("./routes/adoptionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const { statusRouter: aiStatusRouter } = require("./routes/aiRoutes");
const {
  catalogueRouter: vaccineCatalogue,
  recordsRouter: vaccinationRecords
} = require("./routes/vaccinationRoutes");
const ownerRoutes = require("./routes/ownerRoutes");

const app = express();

/**
 * CLIENT_ORIGIN accepts a comma-separated list, because Vercel gives every
 * preview deployment its own URL and a single origin would block them all.
 *   CLIENT_ORIGIN=https://petprint.vercel.app,http://localhost:3000
 */
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No origin: curl, health checks, server-to-server. Allow.
      if (!origin) return callback(null, true);
      const clean = origin.replace(/\/$/, "");
      if (ALLOWED_ORIGINS.includes(clean)) return callback(null, true);
      // Vercel preview builds: <project>-<hash>-<scope>.vercel.app
      if (process.env.ALLOW_VERCEL_PREVIEWS === "true" && /\.vercel\.app$/.test(clean)) {
        return callback(null, true);
      }
      console.warn(`[cors] blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

// Serves locally stored uploads when Cloudinary isn't configured. Harmless when
// it is — the directory simply stays empty.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"), { maxAge: "7d", fallthrough: true })
);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/clinics", clinicsPublic); // public: sign-up dropdown
app.use("/api/clinic", clinicMine);     // scoped: the caller's own clinic
app.use("/api/vets", vetRoutes);        // admin only
app.use("/api/owners", ownerRoutes);    // [vet, admin] owner picker
app.use("/api/pets", petRoutes);        // pets + their record timeline
app.use("/api/records", recordRoutes);  // edit/delete a single record
app.use("/api/search", searchRoutes);   // name, owner, or pet code
app.use("/api/adoptions", adoptionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ai", aiStatusRouter);                 // is the assistant configured?
app.use("/api/vaccines", vaccineCatalogue);        // the schedule catalogue
app.use("/api/vaccinations", vaccinationRecords);  // due list + corrections
app.use("/api/audit-log", require("./routes/auditRoutes"));
app.use("/api/trash", require("./routes/trashRoutes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
