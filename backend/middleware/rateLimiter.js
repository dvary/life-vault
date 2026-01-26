// Simple in-memory rate limiter
const rateLimitMap = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitMap.entries()) {
    if (now - data.firstRequest > data.windowMs) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

const rateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests from this IP, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, {
        count: 1,
        firstRequest: now,
        windowMs
      });
      return next();
    }

    const data = rateLimitMap.get(key);

    // Reset window if expired
    if (now - data.firstRequest > data.windowMs) {
      rateLimitMap.set(key, {
        count: 1,
        firstRequest: now,
        windowMs
      });
      return next();
    }

    // Check if limit exceeded
    if (data.count >= max) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: message,
        retryAfter: Math.ceil((data.firstRequest + data.windowMs - now) / 1000)
      });
    }

    // Increment counter
    data.count++;
    rateLimitMap.set(key, data);

    next();
  };
};

// Specific rate limiters for different endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // limit each IP to 50 uploads per minute
  message: 'Too many file uploads, please try again later.'
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

module.exports = {
  rateLimit,
  authRateLimit,
  uploadRateLimit,
  generalRateLimit
};
