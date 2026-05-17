'use strict';

require('dotenv').config();

const http       = require('http');
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const compression= require('compression');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const connectDB  = require('./config/db');
const authRoutes = require('./routes/auth');
const stateRoutes= require('./routes/state');

const app = express();
const server = http.createServer(app);

// ─── Socket.IO Real-Time Sync ──────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/socket.io'
});

// JWT auth middleware for socket
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (e) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Each user joins their own private room
  socket.join(`user:${socket.userId}`);
  console.log(`[Socket] User ${socket.userId} connected (${socket.id})`);
  socket.on('disconnect', () => {
    console.log(`[Socket] User ${socket.userId} disconnected (${socket.id})`);
  });
});

// Export io so routes can emit events
app.set('io', io);

// ─── Connect Database ────────────────────────────────────────────────────────
connectDB().then(() => seedDefaultUsers());

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(compression());

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { error: 'Too many authentication attempts. Please try again later.' },
  skip: (req) => process.env.NODE_ENV !== 'production' && req.method === 'GET',
});

// ─── CORS & Body Parsing ─────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false                          // served from same origin in prod
    : ['http://localhost:3000', 'http://127.0.0.1:3000',
       'http://localhost:5500', 'http://127.0.0.1:5500',
       'http://localhost:2002', 'http://127.0.0.1:2002'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));   // reduced from 50mb — migrate photos to S3/Cloudinary
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: 'text/plain', limit: '10mb' }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',  authLimiter, authRoutes);

// Handle sendBeacon requests (Content-Type: text/plain) for state sync on tab close
app.use('/api/state', (req, res, next) => {
  if (req.headers['content-type'] === 'text/plain' ||
      req.headers['content-type'] === 'text/plain;charset=UTF-8') {
    try {
      req.body = JSON.parse(req.body || '{}');
      req.headers['content-type'] = 'application/json';
    } catch (e) { /* let it pass through */ }
  }
  next();
});
app.use('/api/state', apiLimiter,  stateRoutes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: Date.now() });
});

// ─── Serve Frontend (Production) ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  etag: false,
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
}));

// Explicitly serve recovery.html before wildcard
app.get('/recovery.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'recovery.html'));
});

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 HabitFlow Pro backend running on http://localhost:${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}`);
  console.log(`   API:      http://localhost:${PORT}/api`);
  console.log(`   Socket:   ws://localhost:${PORT}\n`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n⏳ ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    const mongoose = require('mongoose');
    mongoose.connection.close(false).then(() => {
      console.log('✅ MongoDB connection closed.');
      process.exit(0);
    });
  });
  setTimeout(() => { console.error('⚠️ Forced shutdown.'); process.exit(1); }, 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Seed Default Users ───────────────────────────────────────────────────────
async function seedDefaultUsers() {
  try {
    const User       = require('./models/User');
    const UserData   = require('./models/UserData');
    const GlobalData = require('./models/GlobalData');
    const { getDefaultHabits } = require('./routes/helpers');

    // Ensure GlobalData singleton exists
    const existingGlobal = await GlobalData.findOne({ singleton: 'main' });
    if (!existingGlobal) {
      await GlobalData.create({
        singleton: 'main',
        profiles: {},
        permissions: {
          super_admin: {
            approveAdminAccounts: true, manageAdmins: true, manageUsers: true,
            approveSensitiveChanges: true, approveProfileChanges: true,
            approveDeleteRequests: true, viewAuditLogs: true,
            sendGlobalAnnouncements: true, sendUserNotifications: true,
            sendAdminAnnouncements: true, managePermissions: true,
            moderateJournals: true, viewRecords: true, manageGoals: true,
            manageBadges: true, trackerOverrides: true, verifyProfiles: true,
          },
          admin: {
            approveAdminAccounts: true, manageAdmins: false, manageUsers: true,
            approveSensitiveChanges: true, approveProfileChanges: true,
            approveDeleteRequests: true, viewAuditLogs: true,
            sendGlobalAnnouncements: false, sendUserNotifications: true,
            sendAdminAnnouncements: true, managePermissions: false,
            moderateJournals: true, viewRecords: true, manageGoals: true,
            manageBadges: true, trackerOverrides: true, verifyProfiles: true,
          },
          user: {
            approveAdminAccounts: false, manageAdmins: false, manageUsers: false,
            approveSensitiveChanges: false, approveProfileChanges: false,
            approveDeleteRequests: false, viewAuditLogs: false,
            sendGlobalAnnouncements: false, sendUserNotifications: false,
            sendAdminAnnouncements: false, managePermissions: false,
            moderateJournals: false, viewRecords: false, manageGoals: false,
            manageBadges: false, trackerOverrides: false, verifyProfiles: false,
          },
        },
        requests: [], editRequests: [], announcements: [],
        auditLogs: [], changeLogs: [], badgeHistory: [],
        goalHistory: [], trackerHistory: [],
        settings: {
          security: { confirmDeletes: true, strictSession: true },
          ui: { notificationPanelOpen: false },
        },
        theme: 'light',
      });
      console.log('✅ GlobalData singleton initialized.');
    }

    // Seed default admin (only in development; use env vars or manual creation in production)
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const adminId = 'admin';
      await User.create({
        appId: adminId, username: 'admin', password: 'admin@Harshit123',
        email: 'admin@habitflow.local',
        name: 'Admin', role: 'super_admin', status: 'active',
        createdAt: Date.now(), updatedAt: Date.now(),
      });
      await UserData.create({
        userId: adminId, habits: getDefaultHabits(), records: {}, goals: [],
        todos: [], matrix: { do: [], schedule: [], delegate: [], eliminate: [] },
        journal: {}, life: {}, xp: 0, level: 1, earnedBadges: [],
        pomoSessions: 0, notifications: [], profileNotes: [],
      });
      // Add admin profile to GlobalData
      await GlobalData.findOneAndUpdate(
        { singleton: 'main' },
        { $set: { 'profiles.admin': {
          id: 'admin', fullName: 'Admin', username: 'admin',
          email: 'admin@habitflow.local',
          mobileNumber: '', address: '', birthDate: '',
          gender: '', emergencyContact: '', occupation: '', aboutMe: '',
          profilePhoto: '', verified: true, status: 'active',
          createdAt: Date.now(), updatedAt: Date.now(), allowDirectEdit: true,
        }}},
        { new: true }
      );
      console.log('✅ Default admin user seeded (dev only).');
    }

    // Seed default regular user (only in development)
    const userExists = await User.findOne({ username: 'user' });
    if (!userExists && process.env.NODE_ENV !== 'production') {
      const userId = 'u1';
      await User.create({
        appId: userId, username: 'user', password: 'user1234',
        email: 'user@habitflow.local',
        name: 'User', role: 'user', status: 'active',
        createdAt: Date.now(), updatedAt: Date.now(),
      });
      await UserData.create({
        userId, habits: getDefaultHabits(), records: {}, goals: [],
        todos: [], matrix: { do: [], schedule: [], delegate: [], eliminate: [] },
        journal: {}, life: {}, xp: 0, level: 1, earnedBadges: [],
        pomoSessions: 0, notifications: [], profileNotes: [],
      });
      await GlobalData.findOneAndUpdate(
        { singleton: 'main' },
        { $set: { 'profiles.u1': {
          id: 'u1', fullName: 'User', username: 'user',
          email: 'user@habitflow.local',
          mobileNumber: '', address: '', birthDate: '',
          gender: '', emergencyContact: '', occupation: '', aboutMe: '',
          profilePhoto: '', verified: false, status: 'active',
          createdAt: Date.now(), updatedAt: Date.now(), allowDirectEdit: true,
        }}},
        { new: true }
      );
      console.log('✅ Default regular user seeded (dev only).');
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}
