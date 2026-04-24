(function(){
  'use strict';

  const core = window.HFCore;
  if(!core) return;

  const helpers = core.helpers;
  const { $, uid, esc, openM, toast, confirm } = helpers;
  const HF = window.HFMS = window.HFMS || {};

  HF.roles = {
    super_admin: { label: 'Super Admin', className: 'role-super' },
    admin: { label: 'Admin', className: 'role-admin' },
    user: { label: 'User', className: 'role-user' },
  };

  HF.permissionLabels = {
    approveAdminAccounts: 'Approve admin accounts',
    manageAdmins: 'Manage admins',
    manageUsers: 'Manage users',
    approveSensitiveChanges: 'Approve sensitive changes',
    approveProfileChanges: 'Approve profile changes',
    approveDeleteRequests: 'Approve delete requests',
    viewAuditLogs: 'View audit logs',
    sendGlobalAnnouncements: 'Send global announcements',
    sendUserNotifications: 'Send user notifications',
    sendAdminAnnouncements: 'Send admin-only announcements',
    managePermissions: 'Manage permissions',
    moderateJournals: 'Moderate journals and notes',
    viewRecords: 'View records',
    manageGoals: 'Manage goals',
    manageBadges: 'Manage badges',
    trackerOverrides: 'Override tracker records',
    verifyProfiles: 'Verify profiles',
  };

  HF.defaultPermissions = {
    super_admin: {
      approveAdminAccounts: true,
      manageAdmins: true,
      manageUsers: true,
      approveSensitiveChanges: true,
      approveProfileChanges: true,
      approveDeleteRequests: true,
      viewAuditLogs: true,
      sendGlobalAnnouncements: true,
      sendUserNotifications: true,
      sendAdminAnnouncements: true,
      managePermissions: true,
      moderateJournals: true,
      viewRecords: true,
      manageGoals: true,
      manageBadges: true,
      trackerOverrides: true,
      verifyProfiles: true,
    },
    admin: {
      approveAdminAccounts: true,
      manageAdmins: false,
      manageUsers: true,
      approveSensitiveChanges: true,
      approveProfileChanges: true,
      approveDeleteRequests: true,
      viewAuditLogs: true,
      sendGlobalAnnouncements: false,
      sendUserNotifications: true,
      sendAdminAnnouncements: true,
      managePermissions: false,
      moderateJournals: true,
      viewRecords: true,
      manageGoals: true,
      manageBadges: true,
      trackerOverrides: true,
      verifyProfiles: true,
    },
    user: {
      approveAdminAccounts: false,
      manageAdmins: false,
      manageUsers: false,
      approveSensitiveChanges: false,
      approveProfileChanges: false,
      approveDeleteRequests: false,
      viewAuditLogs: false,
      sendGlobalAnnouncements: false,
      sendUserNotifications: false,
      sendAdminAnnouncements: false,
      managePermissions: false,
      moderateJournals: false,
      viewRecords: false,
      manageGoals: false,
      manageBadges: false,
      trackerOverrides: false,
      verifyProfiles: false,
    },
  };

  HF.requiredProfileFields = [
    'fullName',
    'mobileNumber',
    'email',
    'address',
    'birthDate',
    'occupation',
    'aboutMe',
    'profilePhoto',
  ];

  HF.getDB = core.getDB;
  HF.getCurrentUser = core.getCurrentUser;
  HF.getAppState = core.getAppState;

  HF.saveState = function(){
    core.getFns().save();
  };

  HF.roleLabel = function(role){
    return (HF.roles[role] || HF.roles.user).label;
  };

  HF.roleClass = function(role){
    return (HF.roles[role] || HF.roles.user).className;
  };

  HF.escape = function(value){
    return esc(value == null ? '' : value);
  };

  HF.clone = function(value){
    return JSON.parse(JSON.stringify(value));
  };

  HF.nowLabel = function(timestamp){
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  HF.ensureCollections = function(){
    const DB = HF.getDB();
    if(!Array.isArray(DB.users)) DB.users = [];
    if(!DB.profiles) DB.profiles = {};
    if(!DB.requests) DB.requests = [];
    if(!DB.notifications || Array.isArray(DB.notifications)) DB.notifications = {};
    if(!Array.isArray(DB.announcements)) DB.announcements = [];
    if(!Array.isArray(DB.auditLogs)) DB.auditLogs = [];
    if(!DB.permissions) DB.permissions = HF.clone(HF.defaultPermissions);
    if(!Array.isArray(DB.badgeHistory)) DB.badgeHistory = [];
    if(!Array.isArray(DB.goalHistory)) DB.goalHistory = [];
    if(!Array.isArray(DB.trackerHistory)) DB.trackerHistory = [];
    if(!DB.settings) DB.settings = {};
    if(!DB.settings.security) DB.settings.security = { confirmDeletes: true, strictSession: true };
    if(!DB.settings.ui) DB.settings.ui = { notificationPanelOpen: false };
    if(!Array.isArray(DB.changeLogs)) DB.changeLogs = DB.changeLogs || [];
    if(!Array.isArray(DB.editRequests)) DB.editRequests = DB.editRequests || [];
    if(!DB.profileNotes) DB.profileNotes = {};
  };

  HF.buildProfileFromUser = function(user){
    return {
      id: user.id,
      fullName: user.name || user.username || 'User',
      username: user.username || '',
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
      status: user.status || 'active',
      createdAt: user.createdAt || Date.now(),
      updatedAt: Date.now(),
      allowDirectEdit: true,
    };
  };

  HF.ensureUserContainers = function(userId){
    const DB = HF.getDB();
    if(!DB.habits[userId]) DB.habits[userId] = core.helpers.getDefaultHabits();
    if(!DB.records[userId]) DB.records[userId] = {};
    if(!DB.goals[userId]) DB.goals[userId] = [];
    if(!DB.todos[userId]) DB.todos[userId] = [];
    if(!DB.matrix[userId]) DB.matrix[userId] = { do: [], schedule: [], delegate: [], eliminate: [] };
    if(!DB.journal[userId]) DB.journal[userId] = {};
    if(!DB.life[userId]) DB.life[userId] = {};
    if(typeof DB.xp[userId] !== 'number') DB.xp[userId] = 0;
    if(!DB.earnedBadges[userId]) DB.earnedBadges[userId] = [];
    if(typeof DB.pomoSessions[userId] !== 'number') DB.pomoSessions[userId] = 0;
    if(!DB.notifications[userId]) DB.notifications[userId] = [];
    if(!DB.profileNotes[userId]) DB.profileNotes[userId] = [];
  };

  HF.getProfile = function(userId){
    const DB = HF.getDB();
    return DB.profiles[userId] || null;
  };

  HF.getUserById = function(userId){
    return HF.getDB().users.find(user => user.id === userId) || null;
  };

  HF.getUsersByRole = function(role){
    return HF.getDB().users.filter(user => user.role === role);
  };

  HF.isSuperAdmin = function(user){
    const target = user || HF.getCurrentUser();
    return Boolean(target && target.role === 'super_admin');
  };

  HF.isAdmin = function(user){
    const target = user || HF.getCurrentUser();
    return Boolean(target && (target.role === 'super_admin' || target.role === 'admin'));
  };

  HF.hasPermission = function(permission, user){
    const target = user || HF.getCurrentUser();
    if(!target) return false;
    const DB = HF.getDB();
    const rolePermissions = DB.permissions[target.role] || HF.defaultPermissions[target.role] || {};
    return Boolean(rolePermissions[permission]);
  };

  HF.setPermission = function(role, permission, value){
    const DB = HF.getDB();
    if(!DB.permissions[role]) DB.permissions[role] = {};
    DB.permissions[role][permission] = Boolean(value);
    HF.saveState();
  };

  HF.getNotificationTargets = function(audience, targetUserId){
    const users = HF.getDB().users.filter(user => user.status !== 'deleted');
    if(audience === 'global') return users.map(user => user.id);
    if(audience === 'admin') return users.filter(user => HF.isAdmin(user)).map(user => user.id);
    if(audience === 'user' && targetUserId) return [targetUserId];
    return [];
  };

  HF.findCredentialUser = function(identity, password){
    const lower = identity.trim().toLowerCase();
    return HF.getDB().users.find(user => {
      const profile = HF.getProfile(user.id) || {};
      const matchesIdentity = [
        user.username,
        profile.email,
        profile.mobileNumber,
      ].filter(Boolean).some(value => String(value).toLowerCase() === lower);
      return matchesIdentity && user.password === password;
    }) || null;
  };

  HF.isProfileComplete = function(profile){
    return HF.requiredProfileFields.every(field => String(profile[field] || '').trim());
  };

  HF.normalizeDB = function(){
    const DB = HF.getDB();
    HF.ensureCollections();

    DB.permissions = {
      super_admin: { ...HF.defaultPermissions.super_admin, ...(DB.permissions.super_admin || {}) },
      admin: { ...HF.defaultPermissions.admin, ...(DB.permissions.admin || {}) },
      user: { ...HF.defaultPermissions.user, ...(DB.permissions.user || {}) },
    };

    DB.users = DB.users.map((user, index) => {
      const next = { ...user };
      if(next.username === 'admin' && next.role === 'admin') next.role = 'super_admin';
      if(index === 0 && next.username === 'admin' && !HF.getDB().users.some(item => item.role === 'super_admin')) next.role = 'super_admin';
      if(!next.role) next.role = index === 0 ? 'super_admin' : 'user';
      if(!next.status) next.status = 'active';
      if(!next.createdAt) next.createdAt = Date.now();
      next.updatedAt = Date.now();
      return next;
    });

    if(!DB.users.some(user => user.role === 'super_admin') && DB.users[0]){
      DB.users[0].role = 'super_admin';
    }

    DB.users.forEach(user => {
      const existingProfile = DB.profiles[user.id] || {};
      const defaults = HF.buildProfileFromUser(user);
      DB.profiles[user.id] = {
        ...defaults,
        ...existingProfile,
        id: user.id,
        username: user.username || existingProfile.username || defaults.username,
        fullName: existingProfile.fullName || user.name || defaults.fullName,
        status: user.status || existingProfile.status || 'active',
        allowDirectEdit: existingProfile.allowDirectEdit !== false,
        updatedAt: Date.now(),
      };
      user.name = DB.profiles[user.id].fullName || user.name;
      HF.ensureUserContainers(user.id);
    });

    if(!DB.requests.some(request => request.legacyMigrated) && DB.editRequests.length){
      DB.editRequests.forEach(request => {
        const exists = DB.requests.some(item => item.id === request.id);
        if(exists) return;
        DB.requests.push({
          id: request.id || uid(),
          type: 'tracker_override',
          title: 'Tracker correction request',
          summary: `${request.habitName} on ${request.date}`,
          resourceType: 'tracker',
          targetUserId: request.userId,
          requestedById: request.userId,
          requestedByName: request.username,
          requestedByRole: 'user',
          reason: request.reason || '',
          requestComment: request.reason || '',
          responseComment: request.responseComment || '',
          status: request.status || 'pending',
          payload: {
            userId: request.userId,
            habitId: request.habitId,
            year: request.year,
            month: request.month,
            day: request.day,
            value: request.value == null ? 1 : request.value,
          },
          createdAt: request.at || Date.now(),
          updatedAt: request.at || Date.now(),
          legacyMigrated: true,
        });
      });
    }
  };

  HF.renderRolePill = function(role){
    return `<span class="role-pill ${HF.roleClass(role)}">${HF.roleLabel(role)}</span>`;
  };

  HF.renderStatusPill = function(status){
    const safe = HF.escape(status || 'active');
    return `<span class="status-pill status-${safe.replace(/[^a-z_]/g, '')}">${safe.replace(/_/g, ' ')}</span>`;
  };

  HF.touchProfile = function(userId, fields){
    const DB = HF.getDB();
    const profile = HF.getProfile(userId) || HF.buildProfileFromUser(HF.getUserById(userId));
    DB.profiles[userId] = {
      ...profile,
      ...fields,
      updatedAt: Date.now(),
    };
  };

  HF.updateUserRole = function(userId, role, comment){
    const user = HF.getUserById(userId);
    if(!user) return;
    user.role = role;
    user.updatedAt = Date.now();
    HF.touchProfile(userId, { status: user.status });
    HF.logAction && HF.logAction('Role changed', comment || `Role updated to ${HF.roleLabel(role)}.`, {
      targetUserId: userId,
      userName: HF.getProfile(userId)?.fullName || user.username,
      role,
    });
    HF.saveState();
  };

  HF.setUserStatus = function(userId, status, comment){
    const user = HF.getUserById(userId);
    if(!user) return;
    user.status = status;
    user.updatedAt = Date.now();
    HF.touchProfile(userId, { status });
    HF.logAction && HF.logAction('Account status updated', comment || `Account marked ${status}.`, {
      targetUserId: userId,
      userName: HF.getProfile(userId)?.fullName || user.username,
      role: user.role,
    });
    HF.notifyUser && HF.notifyUser(userId, {
      title: 'Account update',
      message: `Your account status is now ${status}.`,
      type: 'account',
      section: 'profile',
    });
    HF.saveState();
  };

  HF.deleteAccount = function(userId, comment){
    const DB = HF.getDB();
    const user = HF.getUserById(userId);
    if(!user) return false;
    if(HF.getCurrentUser() && HF.getCurrentUser().id === userId && HF.isSuperAdmin(user)){
      toast('You cannot delete the active Super Admin account.');
      return false;
    }
    DB.users = DB.users.filter(item => item.id !== userId);
    delete DB.profiles[userId];
    delete DB.habits[userId];
    delete DB.records[userId];
    delete DB.goals[userId];
    delete DB.todos[userId];
    delete DB.matrix[userId];
    delete DB.journal[userId];
    delete DB.life[userId];
    delete DB.notifications[userId];
    delete DB.profileNotes[userId];
    delete DB.xp[userId];
    delete DB.earnedBadges[userId];
    delete DB.pomoSessions[userId];
    DB.requests.forEach(request => {
      if(request.targetUserId === userId && request.status === 'pending'){
        request.status = 'cancelled';
        request.responseComment = 'Account removed by admin.';
        request.updatedAt = Date.now();
      }
    });
    HF.logAction && HF.logAction('Account deleted', comment || 'Profile and records removed.', {
      targetUserId: userId,
      userName: user.name || user.username,
      role: user.role,
    });
    HF.saveState();
    return true;
  };

  HF.refreshAll = function(){
    if(HF.renderProfileSection) HF.renderProfileSection();
    if(HF.renderAnnouncementCenter) HF.renderAnnouncementCenter();
    if(HF.renderNotificationPanel) HF.renderNotificationPanel();
    if(HF.renderDashboardBanner) HF.renderDashboardBanner();
    if(HF.renderAdminDashboard) HF.renderAdminDashboard();
  };

  const baseLoad = core.getFns().load;
  const baseLoginUser = core.getFns().loginUser;
  const baseLogout = core.getFns().logout;
  const baseInitApp = core.getFns().initApp;
  const baseRenderSidebarUser = core.getFns().renderSidebarUser;
  const baseGoTo = core.getFns().goTo;

  core.override({
    load: function(){
      baseLoad();
      HF.normalizeDB();
    },
    loginUser: function(user){
      HF.normalizeDB();
      const fullUser = HF.getUserById(user.id) || user;
      const loginError = $('login-err');
      if(fullUser.status === 'pending'){
        if(loginError){
          loginError.textContent = 'This account is pending admin approval.';
          loginError.classList.remove('hidden');
        }
        return;
      }
      if(fullUser.status === 'suspended'){
        if(loginError){
          loginError.textContent = 'This account is suspended. Contact an administrator.';
          loginError.classList.remove('hidden');
        }
        return;
      }
      baseLoginUser(fullUser);
      localStorage.setItem('hf_session', JSON.stringify({ id: fullUser.id, at: Date.now() }));
      HF.touchProfile(fullUser.id, { lastLoginAt: Date.now() });
      HF.logAction && HF.logAction('Login', 'Signed in successfully.', {
        targetUserId: fullUser.id,
        userName: HF.getProfile(fullUser.id)?.fullName || fullUser.username,
        role: fullUser.role,
      });
      HF.saveState();
      HF.refreshAll();
    },
    logout: function(){
      const currentUser = HF.getCurrentUser();
      if(currentUser){
        HF.touchProfile(currentUser.id, { lastLogoutAt: Date.now() });
        HF.logAction && HF.logAction('Logout', 'Signed out successfully.', {
          targetUserId: currentUser.id,
          userName: HF.getProfile(currentUser.id)?.fullName || currentUser.username,
          role: currentUser.role,
        });
        HF.saveState();
      }
      localStorage.removeItem('hf_session');
      baseLogout();
    },
    initApp: function(){
      HF.normalizeDB();
      baseInitApp();
      const adminButton = $('btn-admin') || $('btn-admin-panel');
      if(adminButton) adminButton.style.display = HF.isAdmin() ? 'inline-flex' : 'none';
      HF.refreshAll();
    },
    renderSidebarUser: function(){
      const currentUser = HF.getCurrentUser();
      if(!currentUser) return baseRenderSidebarUser();
      const profile = HF.getProfile(currentUser.id) || HF.buildProfileFromUser(currentUser);
      const statusMarkup = [
        HF.renderRolePill(currentUser.role),
        profile.verified ? '<span class="status-pill status-approved">Verified</span>' : '<span class="status-pill status-pending">Unverified</span>',
      ].join('');
      $('sidebar-user').innerHTML = `
        <div class="sidebar-user-card">
          <div class="sidebar-user-avatar">
            ${profile.profilePhoto ? `<img src="${profile.profilePhoto}" alt="${HF.escape(profile.fullName)}"/>` : `<span>${HF.escape((profile.fullName || currentUser.username || 'U').slice(0, 1).toUpperCase())}</span>`}
          </div>
          <div class="sidebar-user-meta">
            <div class="su-name">${HF.escape(profile.fullName || currentUser.name)}</div>
            <div class="su-role-line">${HF.escape(currentUser.username)}</div>
            <div class="sidebar-user-tags">${statusMarkup}</div>
          </div>
        </div>`;
    },
    goTo: function(section){
      baseGoTo(section);
      if(section === 'profile' && HF.renderProfileSection) HF.renderProfileSection();
      if(section === 'announcements' && HF.renderAnnouncementCenter) HF.renderAnnouncementCenter();
    },
  });

  HF.normalizeDB();
})();
