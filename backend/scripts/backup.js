/**
 * Application-level backup, because MongoDB Atlas's free (M0) tier has no
 * built-in automated backups at all — that's a paid-tier feature. This is
 * the practical stopgap: export every collection to JSON, zip it, upload it
 * to Cloudinary (already configured for image storage) as a raw resource,
 * and prune anything older than the retention window.
 *
 * This is NOT a substitute for Atlas's own point-in-time backups once you
 * can afford the paid tier — a full mongodump/restore is more complete and
 * far faster to restore from at scale. Treat this as "better than nothing,"
 * not "production-grade."
 *
 *   node scripts/backup.js                 # runs a backup now
 *   node scripts/backup.js --restore-list   # lists backups available in Cloudinary
 *
 * Intended to run daily via a Render Cron Job, same pattern as reminder-scan.js.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const archiver = require("archiver");
const cloudinary = require("cloudinary").v2;
const { connectDB } = require("../src/config/db");
const mongoose = require("mongoose");

const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 14);
const CLOUDINARY_FOLDER = "petprint/backups";

function configureCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.error("CLOUDINARY_* env vars are not set — backups need the same Cloudinary account already used for images.");
    process.exit(1);
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

async function exportAllCollections(tmpDir) {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const manifest = { exportedAt: new Date().toISOString(), collections: [] };

  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    const docs = await mongoose.connection.db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(tmpDir, `${name}.json`), JSON.stringify(docs, null, 0));
    manifest.collections.push({ name, count: docs.length });
    console.log(`  exported ${name}: ${docs.length} documents`);
  }

  fs.writeFileSync(path.join(tmpDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

function zipDirectory(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function uploadToCloudinary(zipPath, stamp) {
  const result = await cloudinary.uploader.upload(zipPath, {
    resource_type: "raw",
    folder: CLOUDINARY_FOLDER,
    public_id: `petprint-backup-${stamp}`,
    overwrite: false
  });
  return result;
}

async function pruneOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 864e5;
  const result = await cloudinary.api.resources({
    resource_type: "raw",
    type: "upload",
    prefix: CLOUDINARY_FOLDER,
    max_results: 500
  });

  const stale = (result.resources || []).filter(
    (r) => new Date(r.created_at).getTime() < cutoff
  );

  for (const r of stale) {
    await cloudinary.uploader.destroy(r.public_id, { resource_type: "raw" });
    console.log(`  pruned old backup: ${r.public_id} (${r.created_at})`);
  }
  return stale.length;
}

async function listBackups() {
  configureCloudinary();
  const result = await cloudinary.api.resources({
    resource_type: "raw", type: "upload", prefix: CLOUDINARY_FOLDER, max_results: 100
  });
  const backups = (result.resources || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  console.log(`\n${backups.length} backup(s) in Cloudinary:\n`);
  for (const b of backups) {
    console.log(`  ${b.created_at}  ${(b.bytes / 1024).toFixed(0)} KB  ${b.secure_url}`);
  }
  console.log("\nTo restore: download the zip, extract it, and re-import each\n" +
    "collection's .json with mongoimport, or write a small script using\n" +
    "the same models to re-insert documents. There is no one-command\n" +
    "automatic restore — deliberately: restoring into a live database\n" +
    "should be a considered, manual action, not a script you can run by accident.\n");
}

(async () => {
  if (process.argv.includes("--restore-list")) {
    await listBackups();
    process.exit(0);
  }

  configureCloudinary();
  await connectDB(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/petprint");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "petprint-backup-"));
  const zipPath = path.join(os.tmpdir(), `petprint-backup-${stamp}.zip`);

  console.log(`Backing up ${mongoose.connection.name}...`);
  const manifest = await exportAllCollections(tmpDir);

  console.log("Zipping...");
  await zipDirectory(tmpDir, zipPath);
  const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(0);

  console.log("Uploading to Cloudinary...");
  const uploaded = await uploadToCloudinary(zipPath, stamp);

  console.log("Pruning backups older than", RETENTION_DAYS, "days...");
  const pruned = await pruneOldBackups();

  // Local cleanup — nothing is left on Render's ephemeral disk either way,
  // but tidy up rather than rely on that.
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });

  console.log(
    `\nBackup complete: ${manifest.collections.length} collections, ${sizeKb} KB, ` +
    `uploaded as ${uploaded.public_id}. Pruned ${pruned} old backup(s).\n`
  );

  await mongoose.connection.close();
  process.exit(0);
})().catch(async (err) => {
  console.error("Backup failed:", err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
