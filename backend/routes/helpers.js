'use strict';

const User = require('../models/User');
const UserData = require('../models/UserData');
const GlobalData = require('../models/GlobalData');
const bcrypt = require('bcryptjs');

// ─── Generate a unique app-level user ID ─────────────────────────────────────
function generateAppId() {
  return Math.random().toString(36).slice(2, 11) + Math.random().toString(36).slice(2, 6);
}

// ─── Default habits for new users (mirrors frontend getDefaultHabits) ─────────
function getDefaultHabits() {
  const uid = () => Math.random().toString(36).slice(2, 11);
  return [
    { id: uid(), name: 'Exercise',    emoji: '💪', category: 'fitness',     priority: 'high',   color: '#4F8EF7', desc: '', notes: 'Push-ups, squats, cardio',  startTime: '07:00', endTime: '07:45', reminder: 10, repeat: 'daily' },
    { id: uid(), name: 'Read Book',   emoji: '📚', category: 'learning',    priority: 'medium', color: '#22C55E', desc: '', notes: '30 min minimum',            startTime: '21:00', endTime: '21:30', reminder: 10, repeat: 'daily' },
    { id: uid(), name: 'Meditation',  emoji: '🧘', category: 'mindfulness', priority: 'medium', color: '#8B5CF6', desc: '', notes: 'Deep breathing focus',      startTime: '06:30', endTime: '07:00', reminder:  5, repeat: 'daily' },
    { id: uid(), name: 'Drink Water', emoji: '💧', category: 'health',      priority: 'low',    color: '#06B6D4', desc: '', notes: '8 glasses',                 startTime: '',      endTime: '',      reminder:  0, repeat: 'daily' },
    { id: uid(), name: 'Coding',      emoji: '💻', category: 'work',        priority: 'high',   color: '#F59E0B', desc: '', notes: 'Build projects daily',      startTime: '20:00', endTime: '22:00', reminder: 15, repeat: 'weekdays' },
  ];
}

// ─── Assemble the full DB object the frontend expects ────────────────────────
async function assembleDB() {
  const [users, allUserData, globalData] = await Promise.all([
    User.find({}).lean(),
    UserData.find({}).lean(),
    GlobalData.findOne({ singleton: 'main' }).lean(),
  ]);

  const global = globalData || {};

  // Build per-user keyed maps
  const habits = {}, records = {}, goals = {}, todos = {}, matrix = {};
  const journal = {}, life = {}, xp = {}, level = {}, earnedBadges = {};
  const pomoSessions = {}, notifications = {}, profileNotes = {};
  const goalTasks = {}, goalNotes = {}, goalReminders = {}, upcomingTimeline = {};
  const waterTracker = {}, medicineTracker = {};

  allUserData.forEach(ud => {
    const uid = ud.userId;
    habits[uid]        = ud.habits        || [];
    records[uid]       = ud.records       || {};
    goals[uid]         = ud.goals         || [];
    todos[uid]         = ud.todos         || [];
    matrix[uid]        = ud.matrix        || { do: [], schedule: [], delegate: [], eliminate: [] };
    journal[uid]       = ud.journal       || {};
    life[uid]          = ud.life          || {};
    xp[uid]            = ud.xp            || 0;
    level[uid]         = ud.level         || 1;
    earnedBadges[uid]  = ud.earnedBadges  || [];
    pomoSessions[uid]  = ud.pomoSessions  || 0;
    notifications[uid] = ud.notifications || [];
    profileNotes[uid]  = ud.profileNotes  || {};
    goalTasks[uid]     = ud.goalTasks     || [];
    goalNotes[uid]     = ud.goalNotes     || {};
    goalReminders[uid]  = ud.goalReminders  || [];
    upcomingTimeline[uid] = ud.upcomingTimeline || [];
    waterTracker[uid]  = ud.waterTracker  || {};
    medicineTracker[uid] = ud.medicineTracker || {};
  });

  // Build users array without passwords
  const safeUsers = users.map(u => ({
    id: u.appId,
    name: u.name,
    username: u.username,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));

  return {
    users: safeUsers,
    habits, records, goals, todos, matrix,
    journal, life, xp, level, earnedBadges, pomoSessions,
    notifications, profileNotes,
    profiles:       global.profiles       || {},
    permissions:    global.permissions    || {},
    requests:       global.requests       || [],
    editRequests:   global.editRequests   || [],
    announcements:  global.announcements  || [],
    auditLogs:      global.auditLogs      || [],
    changeLogs:     global.changeLogs     || [],
    badgeHistory:   global.badgeHistory   || [],
    goalHistory:    global.goalHistory    || [],
    trackerHistory: global.trackerHistory || [],
    waterTracker, medicineTracker,
    goalTasks, goalNotes, goalReminders, upcomingTimeline,
    settings:       global.settings       || {},
    theme:          global.theme          || 'light',
  };
}

// ─── Save the entire DB from frontend into MongoDB collections ───────────────
async function saveDB(frontendDB, requestingUser) {
  const {
    users, habits, records, goals, todos, matrix,
    journal, life, xp, level, earnedBadges, pomoSessions,
    notifications, profileNotes,
    waterTracker, medicineTracker,
    goalTasks, goalNotes, goalReminders, upcomingTimeline,
    profiles, permissions, requests, editRequests, announcements,
    auditLogs, changeLogs, badgeHistory, goalHistory, trackerHistory,
    settings, theme,
  } = frontendDB;

  const requestingUserId = requestingUser?.id;
  const requestingUserRole = requestingUser?.role;
  const isAdmin = requestingUserRole === 'admin' || requestingUserRole === 'super_admin';
  const isSuperAdmin = requestingUserRole === 'super_admin';

  // 1. Update user role/status — ONLY allow modifying your own data unless admin
  if (Array.isArray(users)) {
    const userOps = [];
    for (const u of users) {
      if (!u?.id) continue;
      // Non-admins can only update their own role/status (and even that is limited)
      if (!isAdmin && u.id !== requestingUserId) continue;
      // Admins cannot modify super_admin users (except super_admin)
      const targetUser = await User.findOne({ appId: u.id }).select('role');
      if (targetUser && targetUser.role === 'super_admin' && !isSuperAdmin) continue;

      if (targetUser) {
        // Existing user — update
        userOps.push({
          updateOne: {
            filter: { appId: u.id },
            update: {
              $set: {
                role:      u.role      || 'user',
                status:    u.status    || 'active',
                name:      u.name      || u.username,
                updatedAt: Date.now(),
              },
            },
          },
        });
      } else if (isAdmin && u.username && u.password) {
        // New user created via frontend approval — create in MongoDB
        const hashedPassword = await bcrypt.hash(u.password, 12);
        try {
          await User.create({
            appId: u.id,
            username: (u.username || '').toLowerCase().trim(),
            email: u.email || `${(u.username || u.id)}@habitflow.local`,
            password: hashedPassword,
            name: u.name || u.username,
            role: u.role || 'user',
            status: u.status || 'active',
            createdAt: u.createdAt || Date.now(),
            updatedAt: Date.now(),
          });
        } catch (createErr) {
          // Duplicate key or validation error — skip silently
          if (createErr.code !== 11000) console.warn('User create error:', createErr.message);
        }
      }
    }
    if (userOps.length > 0) {
      await User.bulkWrite(userOps, { ordered: false });
    }
  }

  // 2. Collect all user IDs across all per-user data maps
  const userIds = new Set([
    ...Object.keys(habits        || {}),
    ...Object.keys(records       || {}),
    ...Object.keys(goals         || {}),
    ...Object.keys(todos         || {}),
    ...Object.keys(matrix        || {}),
    ...Object.keys(journal       || {}),
    ...Object.keys(life          || {}),
    ...Object.keys(xp            || {}),
    ...Object.keys(earnedBadges  || {}),
    ...Object.keys(pomoSessions  || {}),
    ...Object.keys(notifications || {}),
    ...Object.keys(profileNotes  || {}),
    ...Object.keys(waterTracker  || {}),
    ...Object.keys(medicineTracker|| {}),
    ...Object.keys(goalTasks      || {}),
    ...Object.keys(goalNotes      || {}),
    ...Object.keys(goalReminders  || {}),
    ...Object.keys(upcomingTimeline|| {}),
  ]);

  // 3. Upsert per-user data — enforce ownership (non-admins can only save their own data)
  const udOps = [];
  for (const uid of userIds) {
    if (!uid) continue;
    // Ownership check: non-admins can only write their own UserData
    if (!isAdmin && uid !== requestingUserId) continue;

    udOps.push({
      updateOne: {
        filter: { userId: uid },
        update: {
          $set: {
            userId:       uid,
            habits:       habits?.[uid]        ?? [],
            records:      records?.[uid]       ?? {},
            goals:        goals?.[uid]         ?? [],
            todos:        todos?.[uid]         ?? [],
            matrix:       matrix?.[uid]        ?? { do: [], schedule: [], delegate: [], eliminate: [] },
            journal:      journal?.[uid]       ?? {},
            life:         life?.[uid]          ?? {},
            xp:           xp?.[uid]            ?? 0,
            level:        level?.[uid]         ?? 1,
            earnedBadges: earnedBadges?.[uid]  ?? [],
            pomoSessions: pomoSessions?.[uid]  ?? 0,
            notifications:notifications?.[uid] ?? [],
            profileNotes: profileNotes?.[uid]  ?? {},
            waterTracker:  waterTracker?.[uid]  ?? {},
            medicineTracker: medicineTracker?.[uid] ?? {},
            goalTasks:       goalTasks?.[uid]      ?? [],
            goalNotes:       goalNotes?.[uid]      ?? {},
            goalReminders:   goalReminders?.[uid]   ?? [],
            upcomingTimeline: upcomingTimeline?.[uid] ?? [],
          },
        },
        upsert: true,
      },
    });
  }
  if (udOps.length > 0) {
    await UserData.bulkWrite(udOps, { ordered: false });
  }

  // 4. Upsert global data — ONLY admins can modify global collections
  if (isAdmin) {
    await GlobalData.findOneAndUpdate(
      { singleton: 'main' },
      {
        $set: {
          singleton:      'main',
          profiles:       profiles       || {},
          permissions:    permissions    || {},
          requests:       requests       || [],
          editRequests:   editRequests   || [],
          announcements:  announcements  || [],
          auditLogs:      (auditLogs     || []).slice(0, 2500),
          changeLogs:     (changeLogs    || []).slice(-2500),
          badgeHistory:   badgeHistory   || [],
          goalHistory:    goalHistory    || [],
          trackerHistory: trackerHistory || [],
          settings:       settings       || {},
          theme:          theme          || 'light',
        },
      },
      { upsert: true, new: true }
    );
  }
}

module.exports = { assembleDB, saveDB, getDefaultHabits, generateAppId };
