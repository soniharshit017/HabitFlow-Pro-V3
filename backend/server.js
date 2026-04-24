'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const connectDB  = require('./config/db');
const authRoutes = require('./routes/auth');
const stateRoutes= require('./routes/state');

const app = express();

// ─── Connect Database ────────────────────────────────────────────────────────
connectDB().then(() => seedDefaultUsers());

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false                          // served from same origin in prod
    : ['http://localhost:3000', 'http://127.0.0.1:3000',
       'http://localhost:5500', 'http://127.0.0.1:5500'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));   // large payloads (base64 profile photos, big records)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/state', stateRoutes);

// ─── Serve Frontend (Production) ─────────────────────────────────────────────
// In production the frontend folder sits one level up
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 HabitFlow Pro backend running on http://localhost:${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}`);
  console.log(`   API:      http://localhost:${PORT}/api`);
  console.log(`   Default admin → admin / admin123`);
  console.log(`   Default user  → user  / user123\n`);
});

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

    // Seed default admin
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const adminId = 'admin';
      await User.create({
        appId: adminId, username: 'admin', password: 'admin123',
        name: 'Admin', role: 'admin', status: 'active',
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
          mobileNumber: '', email: '', address: '', birthDate: '',
          gender: '', emergencyContact: '', occupation: '', aboutMe: '',
          profilePhoto: '', verified: true, status: 'active',
          createdAt: Date.now(), updatedAt: Date.now(), allowDirectEdit: true,
        }}},
        { new: true }
      );
      console.log('✅ Default admin user seeded (admin / admin123).');
    }

    // Seed default regular user
    const userExists = await User.findOne({ username: 'user' });
    if (!userExists) {
      const userId = 'u1';
      await User.create({
        appId: userId, username: 'user', password: 'user123',
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
          mobileNumber: '', email: '', address: '', birthDate: '',
          gender: '', emergencyContact: '', occupation: '', aboutMe: '',
          profilePhoto: '', verified: false, status: 'active',
          createdAt: Date.now(), updatedAt: Date.now(), allowDirectEdit: true,
        }}},
        { new: true }
      );
      console.log('✅ Default regular user seeded (user / user123).');
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}
