import { Request, Response, NextFunction } from 'express';
import validator from 'validator';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { isDev, cspDirectives } from './config';
import { logError } from './utils';

// Security middleware using Helmet
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: cspDirectives
  },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'same-origin' }
});

// Rate limiting to prevent brute force attacks
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Stricter API endpoint rate limiting
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many API requests, please try again later.' }
});

// Custom middleware to validate and sanitize inputs
export const validateEmailInput = (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;

  // Check if email exists
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  // Sanitize email
  const sanitizedEmail = validator.trim(email);

  // Validate email format
  if (!validator.isEmail(sanitizedEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Replace the original email with sanitized version
  req.body.email = sanitizedEmail;
  next();
};

// Error handling middleware
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logError(`Unhandled error: ${err.message}`).catch(console.error);

  // Don't leak error details to client in production
  if (isDev) {
    res.status(500).json({ error: err.message });
  } else {
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
};