'use strict';

const express = require('express');
const { protect } = require('../middleware/auth');
const { assembleDB, saveDB } = require('./helpers');

const router = express.Router();

// ─── GET /api/state  (fetch full app state) ───────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const db = await assembleDB();
    res.json({ db });
  } catch (err) {
    console.error('GET /api/state error:', err);
    res.status(500).json({ error: 'Failed to load state.' });
  }
});

// ─── POST /api/state  (save full app state) ───────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { db } = req.body;
    if (!db || typeof db !== 'object') {
      return res.status(400).json({ error: 'Invalid state payload.' });
    }
    await saveDB(db, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/state error:', err);
    res.status(500).json({ error: 'Failed to save state.' });
  }
});

module.exports = router;
