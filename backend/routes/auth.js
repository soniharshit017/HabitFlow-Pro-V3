'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserData = require('../models/UserData');
const GlobalData = require('../models/GlobalData');
const { protect } = require('../middleware/auth');
const { assembleDB, getDefaultHabits, generateAppId } = require('./helpers');

const router = express.Router();

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Find user (explicitly select password field)
    const user = await User.findOne({ username: username.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
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
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'All fields required.' });
    }
    if (username.trim().length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters.' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    const exists = await User.findOne({ username: username.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ error: 'Username taken.' });
    }

    const appId = generateAppId();

    const user = await User.create({
      appId,
      username: username.toLowerCase().trim(),
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
        mobileNumber: '',
        email: '',
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
      return res.status(409).json({ error: 'Username taken.' });
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
  // JWT is stateless — client discards token
  res.json({ success: true });
});

module.exports = router;
