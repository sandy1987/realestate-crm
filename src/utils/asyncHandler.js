/**
 * src/utils/asyncHandler.js
 *
 * Wraps asynchronous Express route handlers to catch rejected promises
 * and automatically forward errors to next(err).
 *
 * @param {Function} fn - Async Express middleware or route handler (req, res, next)
 * @returns {Function} Express middleware handler
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
