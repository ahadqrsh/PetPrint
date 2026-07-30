const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { cloudinary, CLOUDINARY_CONFIGURED } = require("../config/cloudinary");

const LOCAL_DIR = path.join(__dirname, "..", "..", "uploads");

/**
 * Stores an uploaded image and returns a URL.
 *
 * Cloudinary when it's configured; otherwise the local disk, which Express
 * serves from /uploads. Only the URL is ever written to MongoDB — never the
 * image bytes.
 */
async function storeImage(file, { folder = "petprint", publicBaseUrl } = {}) {
  if (!file) return "";

  if (CLOUDINARY_CONFIGURED) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: "image" },
        (err, result) => (err ? reject(err) : resolve(result.secure_url))
      );
      stream.end(file.buffer);
    });
  }

  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const ext = (file.mimetype.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(LOCAL_DIR, filename), file.buffer);

  const base = (publicBaseUrl || process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
  return `${base}/uploads/${filename}`;
}

/** Best-effort cleanup when a listing is deleted or its image replaced. */
async function deleteLocalImage(imageUrl) {
  if (!imageUrl || CLOUDINARY_CONFIGURED) return;
  const match = imageUrl.match(/\/uploads\/([\w.-]+)$/);
  if (!match) return;
  await fs.unlink(path.join(LOCAL_DIR, match[1])).catch(() => {});
}

module.exports = { storeImage, deleteLocalImage, LOCAL_DIR, CLOUDINARY_CONFIGURED };
