const { ApiError } = require("./errorHandler");

// validate(schema) -> parses req.body with zod, replaces it with the clean data
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message
      }));
      return next(new ApiError(400, "Validation failed", details));
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
