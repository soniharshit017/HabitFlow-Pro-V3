'use strict';

const jwt = require('jsonwebtoken');

// In-memory token blacklist (resets on server restart; use Redis for production)
const tokenBlacklist = new Set();
const TOKEN_BLACKLIST_MAX = 10000;

// Periodic cleanup — prevent unbounded memory growth
setInterval(() => {
  if (tokenBlacklist.size > TOKEN_BLACKLIST_MAX) {
    // Remove oldest entries (Set maintains insertion order)
    const excess = tokenBlacklist.size - TOKEN_BLACKLIST_MAX;
    let removed = 0;
    for (const token of tokenBlacklist) {
      if (removed >= excess) break;
      tokenBlacklist.delete(token);
      removed++;
    }
  }
}, 60 * 60 * 1000); // every hour

const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    if (tokenBlacklist.has(token)) {
      return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

const superAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required.' });
  }
  next();
};

const revokeToken = (token) => {
  tokenBlacklist.add(token);
};

module.exports = { protect, adminOnly, superAdminOnly, revokeToken };
