// Central error shape: { error: { message, details? } }
// Throw ApiError anywhere; anything else becomes a 500.
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function notFound(req, res) {
  res.status(404).json({ error: { message: `Not found: ${req.method} ${req.originalUrl}` } });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Duplicate key (e.g. email already registered)
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({ error: { message: `That ${field} is already in use.` } });
  }
  const status = err.status || 500;
  const message = status === 500 ? "Something went wrong on our side." : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ error: { message, details: err.details } });
}

module.exports = { ApiError, notFound, errorHandler };
