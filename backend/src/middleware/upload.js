const multer = require("multer");
const { ApiError } = require("./errorHandler");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Memory storage: the buffer goes straight to Cloudinary, or to disk if
// Cloudinary isn't configured. Nothing is written until we've validated it.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new ApiError(400, "Upload a JPEG, PNG, WebP, or GIF image."));
    }
    cb(null, true);
  }
});

// Multer's own errors aren't ApiErrors, so translate the ones users will hit.
function singleImage(field = "image") {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new ApiError(400, "That image is larger than 5 MB."));
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(new ApiError(400, `Send the image in a field called "${field}".`));
      }
      next(err);
    });
  };
}

module.exports = { singleImage, MAX_BYTES, ALLOWED };
