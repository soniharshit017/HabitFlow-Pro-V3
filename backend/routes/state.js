'use strict';

const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const { assembleDB, saveDB } = require('./helpers');
const User = require('../models/User');
const UserData = require('../models/UserData');
const GlobalData = require('../models/GlobalData');

const router = express.Router();

// ─── GET /api/state  (fetch requesting user's own state only) ─────────────────
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

    // For admins, still assemble full DB for the admin panel
    if (isAdmin) {
      const db = await assembleDB();
      return res.json({ db });
    }

    // For regular users, return ONLY their own data + global settings/theme
    const [user, userData, globalData] = await Promise.all([
      User.findOne({ appId: userId }).select('-password').lean(),
      UserData.findOne({ userId }).lean(),
      GlobalData.findOne({ singleton: 'main' }).select('settings theme announcements profiles permissions requests editRequests').lean(),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const safeUser = {
      id: user.appId,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const ud = userData || {};
    const global = globalData || {};

    const db = {
      users: [safeUser],
      habits:        { [userId]: ud.habits        || [] },
      records:       { [userId]: ud.records       || {} },
      goals:         { [userId]: ud.goals         || [] },
      todos:         { [userId]: ud.todos         || [] },
      matrix:        { [userId]: ud.matrix        || { do: [], schedule: [], delegate: [], eliminate: [] } },
      journal:       { [userId]: ud.journal       || {} },
      life:          { [userId]: ud.life          || {} },
      xp:            { [userId]: ud.xp            ?? 0 },
      level:         { [userId]: ud.level         ?? 1 },
      earnedBadges:  { [userId]: ud.earnedBadges  || [] },
      pomoSessions:  { [userId]: ud.pomoSessions  ?? 0 },
      notifications: { [userId]: ud.notifications || [] },
      profileNotes:  { [userId]: ud.profileNotes  || [] },
      waterTracker:    { [userId]: ud.waterTracker    || {} },
      medicineTracker: { [userId]: ud.medicineTracker || {} },
      goalTasks:       { [userId]: ud.goalTasks       || {} },
      goalNotes:       { [userId]: ud.goalNotes       || {} },
      goalReminders:   { [userId]: ud.goalReminders   || [] },
      upcomingTimeline:{ [userId]: ud.upcomingTimeline || [] },
      profiles:       global.profiles       || {},
      permissions:    global.permissions    || {},
      requests:       global.requests       || [],
      editRequests:   global.editRequests   || [],
      announcements:  global.announcements  || [],
      auditLogs:      [],
      changeLogs:     [],
      badgeHistory:   [],
      goalHistory:    [],
      trackerHistory: [],
      settings:       global.settings       || {},
      theme:          global.theme          || 'light',
    };

    res.json({ db });
  } catch (err) {
    console.error('GET /api/state error:', err);
    res.status(500).json({ error: 'Failed to load state.' });
  }
});

// ─── GET /api/state/admin  (admin-only full state dump) ──────────────────────
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const db = await assembleDB();
    res.json({ db });
  } catch (err) {
    console.error('GET /api/state/admin error:', err);
    res.status(500).json({ error: 'Failed to load admin state.' });
  }
});

// ─── POST /api/state  (save full app state) ───────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { db } = req.body;
    if (!db || typeof db !== 'object') {
      return res.status(400).json({ error: 'Invalid state payload.' });
    }
    await saveDB(db, req.user);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/state error:', err);
    res.status(500).json({ error: 'Failed to save state.' });
  }
});

module.exports = router;
