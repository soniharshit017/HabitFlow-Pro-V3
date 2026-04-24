'use strict';

const mongoose = require('mongoose');

// Stores all per-user app data (habits, records, goals, todos, etc.)
const userDataSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  habits:       { type: mongoose.Schema.Types.Mixed, default: [] },
  records:      { type: mongoose.Schema.Types.Mixed, default: {} },
  goals:        { type: mongoose.Schema.Types.Mixed, default: [] },
  todos:        { type: mongoose.Schema.Types.Mixed, default: [] },
  matrix:       { type: mongoose.Schema.Types.Mixed, default: { do: [], schedule: [], delegate: [], eliminate: [] } },
  journal:      { type: mongoose.Schema.Types.Mixed, default: {} },
  life:         { type: mongoose.Schema.Types.Mixed, default: {} },
  xp:           { type: Number, default: 0 },
  level:        { type: Number, default: 1 },
  earnedBadges: { type: [String], default: [] },
  pomoSessions: { type: Number, default: 0 },
  notifications:{ type: mongoose.Schema.Types.Mixed, default: [] },
  profileNotes: { type: mongoose.Schema.Types.Mixed, default: [] },
}, { timestamps: false });

module.exports = mongoose.model('UserData', userDataSchema);
