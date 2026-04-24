'use strict';

const mongoose = require('mongoose');

// Single-document collection for all app-wide shared data
const globalDataSchema = new mongoose.Schema({
  singleton: {
    type: String,
    default: 'main',
    unique: true,
  },
  profiles:       { type: mongoose.Schema.Types.Mixed, default: {} },
  permissions:    { type: mongoose.Schema.Types.Mixed, default: {} },
  requests:       { type: mongoose.Schema.Types.Mixed, default: [] },
  editRequests:   { type: mongoose.Schema.Types.Mixed, default: [] },
  announcements:  { type: mongoose.Schema.Types.Mixed, default: [] },
  auditLogs:      { type: mongoose.Schema.Types.Mixed, default: [] },
  changeLogs:     { type: mongoose.Schema.Types.Mixed, default: [] },
  badgeHistory:   { type: mongoose.Schema.Types.Mixed, default: [] },
  goalHistory:    { type: mongoose.Schema.Types.Mixed, default: [] },
  trackerHistory: { type: mongoose.Schema.Types.Mixed, default: [] },
  settings:       { type: mongoose.Schema.Types.Mixed, default: {} },
  theme:          { type: String, default: 'light' },
}, { timestamps: false });

module.exports = mongoose.model('GlobalData', globalDataSchema);
