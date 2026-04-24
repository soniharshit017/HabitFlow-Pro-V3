/**
 * HabitFlow Pro v3 — api.js
 * API Client: Handles all communication with the Express backend.
 * Loaded BEFORE script.js so HFApi is available during boot.
 */
(function () {
  'use strict';

  // Detect if we're in local dev (file:// or localhost) or production
  const isLocal = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.protocol === 'file:';

  const API_BASE = isLocal ? 'http://localhost:5000/api' : '/api';

  // ── Token helpers ────────────────────────────────────────────────────────
  const TOKEN_KEY = 'hf_token';

  function getToken()    { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t)   { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken()  { localStorage.removeItem(TOKEN_KEY); }

  function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
    return headers;
  }

  // ── Core fetch wrapper ───────────────────────────────────────────────────
  async function request(path, opts = {}) {
    const url = API_BASE + path;
    const config = {
      method:  opts.method  || 'GET',
      headers: opts.skipAuth ? { 'Content-Type': 'application/json' } : authHeaders(),
    };
    if (opts.body) config.body = JSON.stringify(opts.body);

    const response = await fetch(url, config);

    // Auto-clear token on 401 (token expired / invalid)
    if (response.status === 401) {
      clearToken();
      // Don't reload for auth routes (login/register failures should show errors)
      if (!path.startsWith('/auth/')) {
        window.location.reload();
      }
    }

    const data = await response.json();

    if (!response.ok && !data.error) {
      data.error = `Server error (${response.status})`;
    }
    return data;
  }

  // ── Public API ───────────────────────────────────────────────────────────
  window.HFApi = {

    // Token management (exposed for script.js)
    setToken,
    clearToken,
    getToken,

    // Returns true if a token is currently stored
    hasToken() { return Boolean(getToken()); },

    // ── Auth ──────────────────────────────────────────────────────────────

    /**
     * Login with username + password.
     * Returns: { token, db, user } | { error }
     */
    login(username, password) {
      return request('/auth/login', {
        method:   'POST',
        body:     { username, password },
        skipAuth: true,
      });
    },

    /**
     * Register a new user.
     * Returns: { token, db, user } | { error }
     */
    register(name, username, password) {
      return request('/auth/register', {
        method:   'POST',
        body:     { name, username, password },
        skipAuth: true,
      });
    },

    /**
     * Auto-login using a stored JWT token.
     * Returns: { db, user } | { error }
     */
    autoLogin() {
      if (!this.hasToken()) return Promise.resolve({ error: 'No token.' });
      return request('/auth/me');
    },

    /**
     * Logout (server-side is stateless; this call is optional).
     */
    logout() {
      if (!this.hasToken()) return Promise.resolve({ success: true });
      return request('/auth/logout', { method: 'POST' }).catch(() => {});
    },

    // ── State Sync ────────────────────────────────────────────────────────

    /**
     * Fetch the full DB state from the server.
     * Returns: { db } | { error }
     */
    getState() {
      return request('/state');
    },

    /**
     * Push the full DB state to the server.
     * Returns: { success: true } | { error }
     */
    saveState(db) {
      return request('/state', {
        method: 'POST',
        body:   { db },
      });
    },
  };

  console.log('%c🌐 HFApi ready — backend: ' + API_BASE, 'color:#4F8EF7;font-size:11px');
})();
