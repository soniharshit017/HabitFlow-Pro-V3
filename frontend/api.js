/**
 * HabitFlow Pro v3 — api.js
 * API Client: Handles all communication with the Express backend.
 * Loaded BEFORE script.js so HFApi is available during boot.
 * Now includes Socket.IO real-time sync support.
 */
(function () {
  'use strict';

  const isLocal = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.protocol === 'file:';

  const API_BASE    = isLocal ? 'http://localhost:2002/api' : '/api';
  const SOCKET_URL  = isLocal ? 'http://localhost:2002'     : window.location.origin;

  // ── Token helpers ────────────────────────────────────────────────────────
  const TOKEN_KEY = 'hf_token';
  function getToken()   { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t)  { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  // ── Socket.IO instance ───────────────────────────────────────────────────
  let _socket = null;
  let _socketId = null;

  function connectSocket() {
    const token = getToken();
    if (!token) return;
    // Load socket.io client script dynamically if not present
    if (typeof io === 'undefined') {
      const s = document.createElement('script');
      s.src = '/socket.io/socket.io.js';
      s.onload = () => _initSocket(token);
      document.head.appendChild(s);
    } else {
      _initSocket(token);
    }
  }

  function _initSocket(token) {
    if (_socket) _socket.disconnect();
    _socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    _socket.on('connect', () => {
      _socketId = _socket.id;
      console.log('%c🔌 Socket connected: ' + _socketId, 'color:#22c55e;font-size:11px');
    });

    _socket.on('disconnect', () => {
      console.log('%c🔌 Socket disconnected', 'color:#ef4444;font-size:11px');
    });

    // ── Real-time sync event ─────────────────────────────────────────────
    // Another device of the same user saved state → reload from server
    _socket.on('state:sync', async () => {
      console.log('%c🔄 Real-time sync received! Refreshing data...', 'color:#f59e0b;font-size:11px');
      try {
        const res = await window.HFApi.getState();
        if (res && res.db && typeof window.applyServerDB === 'function') {
          window.applyServerDB(res.db);
          console.log('%c✅ UI updated from real-time sync', 'color:#22c55e;font-size:11px');
        }
      } catch (e) {
        console.warn('[HF] Real-time sync reload failed:', e);
      }
    });
  }

  function disconnectSocket() {
    if (_socket) { _socket.disconnect(); _socket = null; _socketId = null; }
  }

  // ── Core fetch wrapper ───────────────────────────────────────────────────
  function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
    // Send socket-id so server excludes this socket from sync broadcast
    if (_socketId) headers['x-socket-id'] = _socketId;
    return headers;
  }

  async function request(path, opts = {}) {
    const url = API_BASE + path;
    const config = {
      method:  opts.method  || 'GET',
      headers: opts.skipAuth ? { 'Content-Type': 'application/json' } : authHeaders(),
      cache: 'no-store',
    };
    if (opts.body) config.body = JSON.stringify(opts.body);

    const response = await fetch(url, config);

    if (response.status === 401) {
      clearToken();
      if (!path.startsWith('/auth/')) window.location.reload();
    }

    const data = await response.json();
    if (!response.ok && !data.error) data.error = `Server error (${response.status})`;
    else if (response.ok && path === '/auth/login') console.log(`[Auth] Login successful`);
    return data;
  }

  // ── Public API ───────────────────────────────────────────────────────────
  window.HFApi = {
    setToken,
    clearToken,
    getToken,
    hasToken()  { return Boolean(getToken()); },
    connectSocket,
    disconnectSocket,

    // ── Auth ──────────────────────────────────────────────────────────────
    login(username, password) {
      return request('/auth/login', { method: 'POST', body: { username, password }, skipAuth: true });
    },
    register(name, email, username, password, profile = {}) {
      return request('/auth/register', { method: 'POST', body: { name, email, username, password, profile }, skipAuth: true });
    },
    autoLogin() {
      if (!this.hasToken()) return Promise.resolve({ error: 'No token.' });
      return request('/auth/me');
    },
    logout() {
      disconnectSocket();
      if (!this.hasToken()) return Promise.resolve({ success: true });
      return request('/auth/logout', { method: 'POST' }).catch(() => {});
    },
    resetPassword(username, email, birthDate, newPassword) {
      return request('/auth/reset-password', { method: 'POST', body: { username, email, birthDate, newPassword }, skipAuth: true });
    },
    updatePasswordVerified(email, username, birthDate, newPassword) {
      return request('/auth/update-password-verified', { method: 'POST', body: { email, username, birthDate, newPassword } });
    },

    // ── State Sync ────────────────────────────────────────────────────────
    getState()    { return request('/state'); },
    saveState(db) { return request('/state', { method: 'POST', body: { db } }); },
  };

  console.log('%c🌐 HFApi ready — backend: ' + API_BASE, 'color:#4F8EF7;font-size:11px');
})();
