'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserData = require('../models/UserData');
const GlobalData = require('../models/GlobalData');
const { protect, adminOnly, superAdminOnly, revokeToken } = require('../middleware/auth');
const { assembleDB, getDefaultHabits, generateAppId } = require('./helpers');

const router = express.Router();

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Find user by username or email (explicitly select password field)
    const normalizedInput = username.toLowerCase().trim();
    const user = await User.findOne({
      $or: [
        { username: normalizedInput },
        { email: normalizedInput },
      ],
    }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid username, email, or password.' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Status check (mirrors frontend users.js logic)
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'This account is pending admin approval.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account is suspended. Contact an administrator.' });
    }

    const token = jwt.sign(
      { id: user.appId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const db = await assembleDB();
    const safeUser = user.toSafeObject();

    res.json({ token, db, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, username, password } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({ error: 'All fields (name, email, username, password) are required.' });
    }
    if (username.trim().length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const usernameExists = await User.findOne({ username: username.toLowerCase().trim() });
    if (usernameExists) {
      return res.status(409).json({ error: 'Username taken.' });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (emailExists) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    const appId = generateAppId();

    const user = await User.create({
      appId,
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password,
      name: name.trim(),
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Initialize per-user data
    await UserData.create({
      userId: appId,
      habits:       getDefaultHabits(),
      records:      {},
      goals:        [],
      todos:        [],
      matrix:       { do: [], schedule: [], delegate: [], eliminate: [] },
      journal:      {},
      life:         {},
      xp:           0,
      level:        1,
      earnedBadges: [],
      pomoSessions: 0,
      notifications:[],
      profileNotes: [],
    });

    // Initialize profile in GlobalData
    const global = await GlobalData.findOne({ singleton: 'main' });
    if (global) {
      if (!global.profiles) global.profiles = {};
      global.profiles[appId] = {
        id: appId,
        fullName: name.trim(),
        username: username.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        mobileNumber: '',
        address: '',
        birthDate: '',
        gender: '',
        emergencyContact: '',
        occupation: '',
        aboutMe: '',
        profilePhoto: '',
        verified: false,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        allowDirectEdit: true,
      };
      global.markModified('profiles');
      await global.save();
    }

    const token = jwt.sign(
      { id: appId, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const db = await assembleDB();
    const safeUser = user.toSafeObject();

    res.status(201).json({ token, db, user: safeUser });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({ error: `That ${field} is already in use.` });
    }
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// ─── GET /api/auth/me  (auto-login via stored token) ─────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findOne({ appId: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended.' });
    }

    const db = await assembleDB();
    res.json({ db, user: user.toSafeObject() });
  } catch (err) {
    console.error('Auto-login error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', protect, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    revokeToken(authHeader.split(' ')[1]);
  }
  res.json({ success: true });
});

// ─── GET /api/auth/users  (admin-only: list all users) ─────────────────────────
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({}).select('-password').lean();
    res.json({ users: users.map(u => ({
      id: u.appId,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })) });
  } catch (err) {
    console.error('Users list error:', err);
    res.status(500).json({ error: 'Failed to list users.' });
  }
});

// ─── PATCH /api/auth/users/:id  (admin-only: update user role/status) ──────────
router.patch('/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const { role, status } = req.body;
    const targetId = req.params.id;

    const targetUser = await User.findOne({ appId: targetId });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Super_admin cannot be modified by regular admins
    if (targetUser.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify a super admin account.' });
    }

    if (role) targetUser.role = role;
    if (status) targetUser.status = status;
    targetUser.updatedAt = Date.now();
    await targetUser.save();

    res.json({ success: true, user: targetUser.toSafeObject() });
  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// ─── DELETE /api/auth/users/:id  (super-admin-only: delete user) ─────────────
router.delete('/users/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const targetId = req.params.id;
    const targetUser = await User.findOne({ appId: targetId });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete a super admin account.' });
    }

    await User.deleteOne({ appId: targetId });
    await UserData.deleteOne({ userId: targetId });

    // Remove from global profiles
    const global = await GlobalData.findOne({ singleton: 'main' });
    if (global && global.profiles && global.profiles[targetId]) {
      delete global.profiles[targetId];
      global.markModified('profiles');
      await global.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('User delete error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

module.exports = router;
