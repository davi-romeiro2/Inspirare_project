// Wraps an async route handler so that thrown errors are forwarded to next().
// Avoids the need for try/catch in every handler.

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
