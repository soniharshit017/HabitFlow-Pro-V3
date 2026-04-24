(function(){
  'use strict';

  const core = window.HFCore;
  const HF = window.HFMS = window.HFMS || {};
  if(!core || !HF.getDB) return;

  const helpers = core.helpers;
  const { $, openM, closeM, confirm, toast, esc, getGoals, getJournal, getBadges } = helpers;
  const appState = HF.getAppState();

  HF.adminState = {
    search: '',
    requestStatus: '',
    requestType: '',
    recordUserId: '',
  };

  HF.injectAdminTabs = function(){
    const tabs = document.querySelector('.admin-tabs');
    if(!tabs) return;
    tabs.innerHTML = `
      <button class="admin-tab active" data-atab="overview">Overview</button>
      <button class="admin-tab" data-atab="requests">Requests</button>
      <button class="admin-tab" data-atab="users">Users</button>
      <button class="admin-tab" data-atab="admins">Admins</button>
      <button class="admin-tab" data-atab="goals">Goals</button>
      <button class="admin-tab" data-atab="badges">Badges</button>
      <button class="admin-tab" data-atab="records">Records</button>
      <button class="admin-tab" data-atab="announcements">Announcements</button>
      <button class="admin-tab" data-atab="permissions">Permissions</button>
      <button class="admin-tab" data-atab="logs">Logs</button>`;
    appState.adminTab = 'overview';
  };

  HF.renderGoals = function(){
    const el = $('goals-grid');
    if(!el) return;
    const goals = getGoals();
    if(!goals.length){
      el.innerHTML = '<div class="empty-msg">No goals yet. Click "+ Add Goal" to start!</div>';
      return;
    }

    el.innerHTML = goals.map(goal => {
      const pct = parseInt(goal.progress || 0, 10);
      const done = pct >= 100;
      const deadline = goal.deadline ? new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline';
      return `
        <article class="goal-card ${done ? 'done-goal' : ''}">
          <div class="gc-top">
            <span class="gc-emoji">${esc(goal.emoji)}</span>
            <div class="gc-acts">
              <button class="hc-btn" data-goal-action="edit" data-goal-id="${goal.id}" title="Edit">Edit</button>
              <button class="hc-btn del" data-goal-action="delete" data-goal-id="${goal.id}" title="Delete">Delete</button>
            </div>
          </div>
          <div class="gc-title">${esc(goal.title)}</div>
          ${goal.why ? `<div class="gc-why">${esc(goal.why)}</div>` : ''}
          <div class="gc-progress-wrap">
            <div class="gc-progress-bar-outer">
              <div class="gc-progress-bar" style="width:${pct}%;background:${done ? 'var(--ok)' : 'var(--pri)'}"></div>
            </div>
            <div class="gc-progress-label">
              <span>${pct}% complete</span>
              <div class="goal-inline-controls">
                <input type="number" class="gc-pct-input" min="0" max="100" value="${pct}" data-goal-progress="${goal.id}"/>
                <button class="btn btn-ghost btn-xs" data-goal-action="save-progress" data-goal-id="${goal.id}">Save</button>
              </div>
            </div>
          </div>
          <div class="gc-deadline">${deadline}</div>
          ${goal.reward ? `<div class="gc-reward">Reward: ${esc(goal.reward)}</div>` : ''}
        </article>`;
    }).join('');
  };

  HF.openGoalModal = function(id){
    appState.editGoalId = id || null;
    $('gm-title').textContent = id ? 'Edit Goal' : 'Add Goal';
    if(id){
      const goal = getGoals().find(item => item.id === id);
      if(goal){
        $('gm-title-input').value = goal.title || '';
        $('gm-deadline').value = goal.deadline || '';
        $('gm-emoji').value = goal.emoji || '';
        $('gm-why').value = goal.why || '';
        $('gm-reward').value = goal.reward || '';
      }
    } else {
      ['gm-title-input', 'gm-deadline', 'gm-emoji', 'gm-why', 'gm-reward'].forEach(idName => {
        $(idName).value = '';
      });
    }
    openM('goal-modal');
    setTimeout(() => $('gm-title-input').focus(), 40);
  };

  HF.saveGoal = function(){
    const title = $('gm-title-input').value.trim();
    if(!title){
      toast('Goal title is required.');
      return;
    }
    const current = HF.getCurrentUser();
    const DB = HF.getDB();
    const data = {
      title,
      deadline: $('gm-deadline').value,
      emoji: $('gm-emoji').value.trim() || 'Target',
      why: $('gm-why').value.trim(),
      reward: $('gm-reward').value.trim(),
      progress: 0,
      status: 'active',
    };

    if(appState.editGoalId){
      const goal = (DB.goals[current.id] || []).find(item => item.id === appState.editGoalId);
      if(!goal) return;
      const nextGoal = { ...goal, ...data, progress: goal.progress };
      if(HF.isAdmin()){
        const index = DB.goals[current.id].findIndex(item => item.id === goal.id);
        DB.goals[current.id][index] = nextGoal;
        HF.logAction && HF.logAction('Goal updated', 'Goal was edited directly by an admin profile.', {
          targetUserId: current.id,
          userName: HF.getProfile(current.id)?.fullName || current.username,
          role: current.role,
        });
        HF.saveState();
        closeM('goal-modal');
        HF.renderGoals();
        core.getFns().updateDashboard();
        return;
      }
      HF.openRequestModal({
        type: 'goal_update',
        title: 'Request Goal Update',
        summary: nextGoal.title,
        context: 'Goal edits require approval so records stay traceable.',
        targetUserId: current.id,
        payload: {
          goal: nextGoal,
        },
      });
      closeM('goal-modal');
      return;
    }

    if(!DB.goals[current.id]) DB.goals[current.id] = [];
    DB.goals[current.id].push({ id: core.helpers.uid(), ...data });
    helpers.addXP(15);
    HF.logAction && HF.logAction('Goal created', 'New goal created by the user.', {
      targetUserId: current.id,
      userName: HF.getProfile(current.id)?.fullName || current.username,
      role: current.role,
    });
    HF.saveState();
    closeM('goal-modal');
    HF.renderGoals();
    core.getFns().updateDashboard();
    core.getFns().checkBadges();
    toast('Goal added.');
  };

  HF.requestGoalDelete = function(goalId){
    const current = HF.getCurrentUser();
    const goal = getGoals().find(item => item.id === goalId);
    if(!goal) return;
    if(HF.isAdmin()){
      const DB = HF.getDB();
      DB.goals[current.id] = (DB.goals[current.id] || []).filter(item => item.id !== goalId);
      HF.logAction && HF.logAction('Goal deleted', 'Goal removed directly by an admin profile.', {
        targetUserId: current.id,
        userName: HF.getProfile(current.id)?.fullName || current.username,
        role: current.role,
      });
      HF.saveState();
      HF.renderGoals();
      core.getFns().updateDashboard();
      return;
    }
    HF.openRequestModal({
      type: 'goal_delete',
      title: 'Request Goal Deletion',
      summary: goal.title,
      context: 'Goal deletions are reviewed before records are removed.',
      targetUserId: current.id,
      payload: {
        goalId,
      },
    });
  };

  HF.requestGoalProgressUpdate = function(goalId, progressValue){
    const current = HF.getCurrentUser();
    const goal = getGoals().find(item => item.id === goalId);
    if(!goal) return;
    const nextGoal = { ...goal, progress: Math.max(0, Math.min(100, Number(progressValue) || 0)) };

    if(HF.isAdmin()){
      const index = HF.getDB().goals[current.id].findIndex(item => item.id === goalId);
      HF.getDB().goals[current.id][index] = nextGoal;
      HF.saveState();
      HF.renderGoals();
      core.getFns().updateDashboard();
      core.getFns().checkBadges();
      return;
    }

    HF.openRequestModal({
      type: 'goal_update',
      title: 'Request Goal Progress Update',
      summary: `${goal.title} -> ${nextGoal.progress}%`,
      context: 'Existing goal edits are routed through approval.',
      targetUserId: current.id,
      payload: {
        goal: nextGoal,
      },
    });
  };

  HF.renderJournal = function(){
    const el = $('journal-grid');
    if(!el) return;
    const entries = Object.entries(getJournal())
      .filter(([, value]) => value.title || value.desc || value.mood !== undefined)
      .sort(([a], [b]) => b.localeCompare(a));
    if(!entries.length){
      el.innerHTML = '<div class="empty-msg">No journal entries yet. Start from the Dashboard!</div>';
      return;
    }

    el.innerHTML = entries.map(([dateKey, value]) => {
      const mood = value.mood !== undefined ? core.helpers.MOOD_MAP[value.mood] : null;
      return `
        <article class="jc">
          <div class="journal-card-top">
            <div class="jc-date">${core.helpers.fmtDateKey(dateKey)}</div>
            <div class="gc-acts">
              <button class="hc-btn" data-journal-action="edit" data-journal-date="${dateKey}">Edit</button>
              <button class="hc-btn del" data-journal-action="delete" data-journal-date="${dateKey}">Delete</button>
            </div>
          </div>
          ${value.title ? `<div class="jc-title">${esc(value.title)}</div>` : ''}
          ${mood ? `<div class="jc-mood">${mood.e} <span style="font-size:13px;color:var(--ts)">${mood.l}</span></div>` : ''}
          ${value.desc ? `<div class="jc-desc">${esc(value.desc)}</div>` : ''}
          ${value.wins ? `<div class="jc-wins">${esc(value.wins)}</div>` : ''}
        </article>`;
    }).join('');
  };

  HF.saveJournal = function(){
    const current = HF.getCurrentUser();
    const DB = HF.getDB();
    const nextEntry = {
      title: $('jm-title').value.trim(),
      mood: appState.selMood,
      desc: $('jm-desc').value.trim(),
      wins: $('jm-wins').value.trim(),
      improve: $('jm-improve').value.trim(),
      energy: parseInt($('jm-energy').value, 10),
      stress: parseInt($('jm-stress').value, 10),
    };
    const existing = (DB.journal[current.id] || {})[appState.journalDate];

    if(existing && !HF.isAdmin()){
      HF.openRequestModal({
        type: 'journal_update',
        title: 'Request Journal Update',
        summary: core.helpers.fmtDateKey(appState.journalDate),
        context: 'Journal edits are reviewed before they are changed.',
        targetUserId: current.id,
        payload: {
          dateKey: appState.journalDate,
          entry: nextEntry,
        },
      });
      closeM('journal-modal');
      return;
    }

    if(!DB.journal[current.id]) DB.journal[current.id] = {};
    DB.journal[current.id][appState.journalDate] = nextEntry;
    helpers.addXP(5);
    HF.logAction && HF.logAction('Journal saved', 'Journal entry saved directly.', {
      targetUserId: current.id,
      userName: HF.getProfile(current.id)?.fullName || current.username,
      role: current.role,
    });
    HF.saveState();
    closeM('journal-modal');
    HF.renderJournal();
    core.getFns().renderLifeSnapshot();
    core.getFns().checkBadges();
    toast('Journal saved.');
  };

  HF.requestJournalDelete = function(dateKey){
    const current = HF.getCurrentUser();
    if(HF.isAdmin()){
      delete HF.getDB().journal[current.id][dateKey];
      HF.saveState();
      HF.renderJournal();
      return;
    }
    HF.openRequestModal({
      type: 'journal_delete',
      title: 'Request Journal Deletion',
      summary: core.helpers.fmtDateKey(dateKey),
      context: 'Journal removals are reviewed before records are deleted.',
      targetUserId: current.id,
      payload: {
        dateKey,
      },
    });
  };

  HF.renderBadges = function(){
    const el = $('badges-grid');
    if(!el) return;
    const earned = getBadges();
    const history = (HF.getDB().badgeHistory || []).filter(item => item.userId === HF.getCurrentUser()?.id).slice(-4).reverse();
    el.innerHTML = `
      ${core.helpers.BADGE_DEFS.map(badge => {
        const active = earned.includes(badge.id);
        return `
          <div class="badge-card ${active ? 'earned' : 'badge-locked'}">
            <span class="bi">${badge.ico}</span>
            <div class="bn">${esc(badge.name)}</div>
            <div class="bd2">${esc(badge.desc)}</div>
            ${active && !HF.isAdmin() ? `<button class="btn btn-ghost btn-xs" style="margin-top:10px" data-badge-request="${badge.id}">Request Remove</button>` : ''}
          </div>`;
      }).join('')}
      ${history.length ? `
        <div class="badge-history-card">
          <div class="profile-card-title">Recent Badge History</div>
          ${history.map(item => `<div class="badge-history-row">${esc(item.badgeId)} · ${esc(item.action)} · ${HF.nowLabel(item.createdAt)}</div>`).join('')}
        </div>` : ''}`;
  };

  HF.requestBadgeRemoval = function(badgeId){
    const current = HF.getCurrentUser();
    HF.openRequestModal({
      type: 'badge_remove',
      title: 'Request Badge Removal',
      summary: badgeId,
      context: 'Badge removals are reviewed to keep achievement records consistent.',
      targetUserId: current.id,
      payload: {
        badgeId,
      },
    });
  };

  HF.renderAdminToolbar = function(tab){
    const search = HF.adminState.search || '';
    if(tab === 'requests'){
      return `
        <div class="admin-toolbar">
          <input type="text" id="admin-search" class="form-input" placeholder="Search requests, names, dates" value="${esc(search)}"/>
          <select id="admin-status-filter" class="form-select">
            <option value="">All Statuses</option>
            <option value="pending" ${HF.adminState.requestStatus === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="approved" ${HF.adminState.requestStatus === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="rejected" ${HF.adminState.requestStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
          <select id="admin-type-filter" class="form-select">
            <option value="">All Types</option>
            ${Object.keys(HF.requestLabels).map(type => `<option value="${type}" ${HF.adminState.requestType === type ? 'selected' : ''}>${esc(HF.requestLabels[type])}</option>`).join('')}
          </select>
        </div>`;
    }

    return `
      <div class="admin-toolbar">
        <input type="text" id="admin-search" class="form-input" placeholder="Search by name, number, role, date, or title" value="${esc(search)}"/>
      </div>`;
  };

  HF.renderOverviewTab = function(){
    const DB = HF.getDB();
    const pendingRequests = DB.requests.filter(item => item.status === 'pending').length;
    const users = DB.users.filter(user => user.role === 'user').length;
    const admins = DB.users.filter(user => user.role === 'admin').length;
    const notifications = HF.getNotifications().filter(item => !item.readAt).length;

    return `
      <div class="admin-overview-grid">
        <div class="score-card"><div class="sc-label">Pending Requests</div><div class="sc-val">${pendingRequests}</div></div>
        <div class="score-card"><div class="sc-label">Users</div><div class="sc-val">${users}</div></div>
        <div class="score-card"><div class="sc-label">Admins</div><div class="sc-val">${admins}</div></div>
        <div class="score-card"><div class="sc-label">Unread Alerts</div><div class="sc-val">${notifications}</div></div>
      </div>
      <div class="admin-split">
        <div class="profile-card">
          <div class="profile-card-title">Recent Requests</div>
          ${HF.renderRequestTable({ status: 'pending' })}
        </div>
      </div>`;
  };

  HF.renderUsersTab = function(){
    const users = HF.getDB().users
      .filter(user => user.role === 'user')
      .filter(user => {
        const search = HF.adminState.search.toLowerCase();
        if(!search) return true;
        const profile = HF.getProfile(user.id);
        return [
          profile?.fullName,
          user.username,
          profile?.mobileNumber,
          profile?.email,
          user.status,
        ].filter(Boolean).some(value => String(value).toLowerCase().includes(search));
      });

    return `
      ${HF.renderAdminToolbar('users')}
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Email</th>
              <th>Status</th>
              <th>Verification</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => {
              const profile = HF.getProfile(user.id);
              return `
                <tr>
                  <td>
                    <div class="table-title">${esc(profile?.fullName || user.name)}</div>
                    <div class="table-sub">${esc(user.username)}</div>
                  </td>
                  <td>${esc(profile?.mobileNumber || '-')}</td>
                  <td>${esc(profile?.email || '-')}</td>
                  <td>${HF.renderStatusPill(user.status || 'active')}</td>
                  <td>${HF.renderStatusPill(profile?.verified ? 'approved' : 'pending')}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-ghost btn-xs" data-user-action="verify" data-user-id="${user.id}">Verify</button>
                      <button class="btn btn-ghost btn-xs" data-user-action="${user.status === 'suspended' ? 'activate' : 'suspend'}" data-user-id="${user.id}">${user.status === 'suspended' ? 'Activate' : 'Suspend'}</button>
                      <button class="btn btn-danger btn-xs" data-user-action="delete" data-user-id="${user.id}">Delete</button>
                    </div>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  };

  HF.renderAdminsTab = function(){
    const admins = HF.getDB().users
      .filter(user => user.role === 'admin' || user.role === 'super_admin')
      .filter(user => {
        const search = HF.adminState.search.toLowerCase();
        if(!search) return true;
        const profile = HF.getProfile(user.id);
        return [
          profile?.fullName,
          user.username,
          user.role,
          user.status,
        ].filter(Boolean).some(value => String(value).toLowerCase().includes(search));
      });

    return `
      ${HF.renderAdminToolbar('admins')}
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${admins.map(user => `
              <tr>
                <td>
                  <div class="table-title">${esc(HF.getProfile(user.id)?.fullName || user.name)}</div>
                  <div class="table-sub">${esc(user.username)}</div>
                </td>
                <td>${HF.renderRolePill(user.role)}</td>
                <td>${HF.renderStatusPill(user.status || 'active')}</td>
                <td>${Object.entries(HF.getDB().permissions[user.role] || {}).filter(([, value]) => value).length} enabled</td>
                <td>
                  <div class="table-actions">
                    ${HF.isSuperAdmin() && user.role === 'admin' ? `<button class="btn btn-ghost btn-xs" data-user-action="make-user" data-user-id="${user.id}">Demote</button>` : ''}
                    ${HF.isSuperAdmin() && user.role === 'admin' ? `<button class="btn btn-ghost btn-xs" data-user-action="${user.status === 'suspended' ? 'activate' : 'suspend'}" data-user-id="${user.id}">${user.status === 'suspended' ? 'Activate' : 'Suspend'}</button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  };

  HF.renderGoalsAdminTab = function(){
    const rows = HF.getDB().users.flatMap(user => {
      const profile = HF.getProfile(user.id);
      return (HF.getDB().goals[user.id] || []).map(goal => ({ user, profile, goal }));
    }).filter(item => {
      const search = HF.adminState.search.toLowerCase();
      if(!search) return true;
      return [
        item.profile?.fullName,
        item.goal.title,
        item.goal.deadline,
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(search));
    });

    return `
      ${HF.renderAdminToolbar('goals')}
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Title</th>
              <th>Deadline</th>
              <th>Progress</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(item => `
              <tr>
                <td>${esc(item.profile?.fullName || item.user.name)}</td>
                <td><input type="text" class="form-input admin-inline-input" value="${esc(item.goal.title)}" data-admin-goal-title="${item.goal.id}" data-admin-goal-user="${item.user.id}"/></td>
                <td><input type="date" class="form-input admin-inline-input" value="${esc(item.goal.deadline || '')}" data-admin-goal-deadline="${item.goal.id}" data-admin-goal-user="${item.user.id}"/></td>
                <td><input type="number" class="form-input admin-inline-input" min="0" max="100" value="${Number(item.goal.progress || 0)}" data-admin-goal-progress="${item.goal.id}" data-admin-goal-user="${item.user.id}"/></td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-primary btn-xs" data-admin-goal-action="save" data-goal-id="${item.goal.id}" data-goal-user="${item.user.id}">Save</button>
                    <button class="btn btn-danger btn-xs" data-admin-goal-action="delete" data-goal-id="${item.goal.id}" data-goal-user="${item.user.id}">Delete</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  };

  HF.renderBadgesAdminTab = function(){
    const userOptions = HF.getDB().users.filter(user => user.status === 'active').map(user => `<option value="${user.id}">${esc(HF.getProfile(user.id)?.fullName || user.name)}</option>`).join('');
    const badgeOptions = core.helpers.BADGE_DEFS.map(badge => `<option value="${badge.id}">${esc(badge.name)}</option>`).join('');
    const rows = HF.getDB().users.flatMap(user => {
      const profile = HF.getProfile(user.id);
      return (HF.getDB().earnedBadges[user.id] || []).map(badgeId => ({ user, profile, badgeId }));
    });

    return `
      ${HF.renderAdminToolbar('badges')}
      <div class="profile-card" style="margin-bottom:16px">
        <div class="profile-card-title">Grant Badge</div>
        <div class="admin-inline-form">
          <select id="admin-badge-user" class="form-select">${userOptions}</select>
          <select id="admin-badge-id" class="form-select">${badgeOptions}</select>
          <button class="btn btn-primary btn-sm" data-admin-badge-grant="1">Grant Badge</button>
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Badge</th>
              <th>History</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(item => `
              <tr>
                <td>${esc(item.profile?.fullName || item.user.name)}</td>
                <td>${esc(item.badgeId)}</td>
                <td>${HF.nowLabel((HF.getDB().badgeHistory || []).find(entry => entry.userId === item.user.id && entry.badgeId === item.badgeId)?.createdAt || Date.now())}</td>
                <td><button class="btn btn-danger btn-xs" data-admin-badge-remove="${item.badgeId}" data-badge-user="${item.user.id}">Remove</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  };

  HF.renderRecordsTab = function(){
    const users = HF.getDB().users.filter(user => user.status === 'active');
    const selectedUserId = HF.adminState.recordUserId || users[0]?.id || '';
    HF.adminState.recordUserId = selectedUserId;
    const habits = selectedUserId ? (HF.getDB().habits[selectedUserId] || []) : [];
    const journalRows = HF.getDB().users.flatMap(user => {
      const profile = HF.getProfile(user.id);
      return Object.entries(HF.getDB().journal[user.id] || {}).map(([dateKey, entry]) => ({ user, profile, dateKey, entry }));
    }).sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 10);

    return `
      ${HF.renderAdminToolbar('records')}
      <div class="admin-split">
        <div class="profile-card">
          <div class="profile-card-title">Tracker Override</div>
          <div class="admin-inline-form stack-mobile">
            <select id="admin-record-user" class="form-select">
              ${users.map(user => `<option value="${user.id}" ${selectedUserId === user.id ? 'selected' : ''}>${esc(HF.getProfile(user.id)?.fullName || user.name)}</option>`).join('')}
            </select>
            <select id="admin-record-habit" class="form-select">
              ${habits.map(habit => `<option value="${habit.id}">${esc(habit.name)}</option>`).join('')}
            </select>
            <input type="date" id="admin-record-date" class="form-input"/>
            <select id="admin-record-value" class="form-select">
              <option value="1">Approved / Done</option>
              <option value="2">Rejected / Missed</option>
              <option value="3">Pending</option>
              <option value="0">Clear</option>
            </select>
            <button class="btn btn-primary btn-sm" data-admin-record-apply="1">Apply Override</button>
          </div>
        </div>
        <div class="profile-card">
          <div class="profile-card-title">Recent Journals</div>
          <div class="admin-feed">
            ${journalRows.length ? journalRows.map(item => `
              <div class="admin-feed-row">
                <div>
                  <div class="table-title">${esc(item.profile?.fullName || item.user.name)} · ${core.helpers.fmtDateKey(item.dateKey)}</div>
                  <div class="table-sub">${esc(item.entry.title || item.entry.desc || 'Journal entry')}</div>
                </div>
              </div>`).join('') : '<div class="empty-msg" style="padding:0">No journal entries yet.</div>'}
          </div>
        </div>
      </div>`;
  };

  HF.renderAnnouncementsTab = function(){
    return `
      ${HF.renderAdminToolbar('announcements')}
      <div class="profile-card">
        <div class="profile-card-title">Compose</div>
        <button class="btn btn-primary btn-sm" data-open-announcement="1">New Announcement</button>
      </div>
      <div class="announcement-center" style="margin-top:16px">
        ${(HF.getDB().announcements || []).length ? HF.getDB().announcements.map(item => `
          <article class="announcement-card">
            <div class="announcement-top">
              <div>
                <div class="announcement-title">${esc(item.title)}</div>
                <div class="announcement-meta">${esc(item.createdByName || 'System')} · ${HF.nowLabel(item.createdAt)}</div>
              </div>
              ${HF.renderStatusPill(item.audience)}
            </div>
            <p class="announcement-body">${esc(item.message)}</p>
          </article>`).join('') : '<div class="empty-msg">No announcements sent yet.</div>'}
      </div>`;
  };

  HF.renderPermissionsTab = function(){
    const roles = ['super_admin', 'admin', 'user'];
    return `
      ${HF.renderAdminToolbar('permissions')}
      <div class="profile-card">
        <div class="profile-card-title">Permission Matrix</div>
        ${!HF.isSuperAdmin() ? '<div class="modal-sub">Only the Super Admin can edit permissions. Admins can view them here.</div>' : ''}
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Permission</th>
                ${roles.map(role => `<th>${HF.renderRolePill(role)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.keys(HF.permissionLabels).map(permission => `
                <tr>
                  <td>${esc(HF.permissionLabels[permission])}</td>
                  ${roles.map(role => `
                    <td>
                      <label class="perm-toggle">
                        <input type="checkbox" data-permission-role="${role}" data-permission-key="${permission}" ${HF.getDB().permissions[role]?.[permission] ? 'checked' : ''} ${HF.isSuperAdmin() ? '' : 'disabled'}/>
                        <span>${HF.getDB().permissions[role]?.[permission] ? 'On' : 'Off'}</span>
                      </label>
                    </td>`).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  };

  HF.renderAdminContent = function(){
    const el = $('admin-content');
    if(!el) return;
    const tab = appState.adminTab || 'overview';

    if(tab === 'overview') el.innerHTML = HF.renderOverviewTab();
    if(tab === 'requests') el.innerHTML = `${HF.renderAdminToolbar('requests')}${HF.renderRequestTable({ search: HF.adminState.search, status: HF.adminState.requestStatus, type: HF.adminState.requestType })}`;
    if(tab === 'users') el.innerHTML = HF.renderUsersTab();
    if(tab === 'admins') el.innerHTML = HF.renderAdminsTab();
    if(tab === 'goals') el.innerHTML = HF.renderGoalsAdminTab();
    if(tab === 'badges') el.innerHTML = HF.renderBadgesAdminTab();
    if(tab === 'records') el.innerHTML = HF.renderRecordsTab();
    if(tab === 'announcements') el.innerHTML = HF.renderAnnouncementsTab();
    if(tab === 'permissions') el.innerHTML = HF.renderPermissionsTab();
    if(tab === 'logs') el.innerHTML = `${HF.renderAdminToolbar('logs')}${HF.renderLogRows(HF.getAuditLogs({ search: HF.adminState.search }))}`;
  };

  HF.renderAdminDashboard = function(){
    const modal = $('admin-modal');
    if(modal?.classList.contains('open')) HF.renderAdminContent();
  };

  HF.openAdmin = function(){
    if(!HF.isAdmin()){
      toast('Admin access is required.');
      return;
    }
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.atab === (appState.adminTab || 'overview'));
    });
    HF.renderAdminContent();
    openM('admin-modal');
  };

  HF.saveAdminGoal = function(userId, goalId){
    const DB = HF.getDB();
    const goals = DB.goals[userId] || [];
    const goal = goals.find(item => item.id === goalId);
    if(!goal) return;
    const titleInput = document.querySelector(`[data-admin-goal-title="${goalId}"][data-admin-goal-user="${userId}"]`);
    const deadlineInput = document.querySelector(`[data-admin-goal-deadline="${goalId}"][data-admin-goal-user="${userId}"]`);
    const progressInput = document.querySelector(`[data-admin-goal-progress="${goalId}"][data-admin-goal-user="${userId}"]`);
    goal.title = titleInput?.value.trim() || goal.title;
    goal.deadline = deadlineInput?.value || '';
    goal.progress = Math.max(0, Math.min(100, Number(progressInput?.value || goal.progress)));
    HF.logAction && HF.logAction('Goal managed', 'Goal updated from the admin dashboard.', {
      targetUserId: userId,
      userName: HF.getProfile(userId)?.fullName || userId,
      role: HF.getCurrentUser()?.role,
    });
    if(HF.notifyUser) HF.notifyUser(userId, {
      title: 'Goal updated by admin',
      message: `${goal.title} was updated from the admin dashboard.`,
      type: 'goal',
      section: 'goals',
    });
    HF.saveState();
    HF.renderAdminContent();
  };

  HF.grantBadge = function(userId, badgeId){
    const badges = HF.getDB().earnedBadges[userId] || [];
    if(!badges.includes(badgeId)) badges.push(badgeId);
    HF.getDB().earnedBadges[userId] = badges;
    HF.getDB().badgeHistory.push({
      id: core.helpers.uid(),
      userId,
      badgeId,
      action: 'granted',
      createdAt: Date.now(),
    });
    HF.logAction && HF.logAction('Badge granted', 'Badge granted from the admin dashboard.', {
      targetUserId: userId,
      userName: HF.getProfile(userId)?.fullName || userId,
      role: HF.getCurrentUser()?.role,
    });
    if(HF.notifyUser) HF.notifyUser(userId, {
      title: 'Badge granted',
      message: `${badgeId} was granted by an administrator.`,
      type: 'badge',
      section: 'badges',
    });
    HF.saveState();
    HF.renderAdminContent();
  };

  HF.removeBadgeDirect = function(userId, badgeId){
    HF.getDB().earnedBadges[userId] = (HF.getDB().earnedBadges[userId] || []).filter(item => item !== badgeId);
    HF.getDB().badgeHistory.push({
      id: core.helpers.uid(),
      userId,
      badgeId,
      action: 'removed',
      createdAt: Date.now(),
    });
    HF.logAction && HF.logAction('Badge removed', 'Badge removed from the admin dashboard.', {
      targetUserId: userId,
      userName: HF.getProfile(userId)?.fullName || userId,
      role: HF.getCurrentUser()?.role,
    });
    if(HF.notifyUser) HF.notifyUser(userId, {
      title: 'Badge removed',
      message: `${badgeId} was removed by an administrator.`,
      type: 'badge',
      section: 'badges',
    });
    HF.saveState();
    HF.renderAdminContent();
  };

  HF.applyAdminTrackerOverride = function(){
    const userId = $('admin-record-user').value;
    const habitId = $('admin-record-habit').value;
    const dateValue = $('admin-record-date').value;
    const value = Number($('admin-record-value').value);
    if(!userId || !habitId || !dateValue){
      toast('Choose a user, habit, and date.');
      return;
    }
    const date = new Date(dateValue);
    const key = core.helpers.rk(habitId, date.getFullYear(), date.getMonth(), date.getDate());
    if(!HF.getDB().records[userId]) HF.getDB().records[userId] = {};
    if(value === 0) delete HF.getDB().records[userId][key];
    else HF.getDB().records[userId][key] = value;
    HF.logAction && HF.logAction('Tracker override applied', 'Tracker value updated from the admin dashboard.', {
      targetUserId: userId,
      userName: HF.getProfile(userId)?.fullName || userId,
      role: HF.getCurrentUser()?.role,
    });
    if(HF.notifyUser) HF.notifyUser(userId, {
      title: 'Tracker updated by admin',
      message: 'A tracker record was overridden by an administrator.',
      type: 'tracker',
      section: 'tracker',
    });
    HF.saveState();
    toast('Tracker override applied.');
  };

  HF.handleAdminUserAction = function(action, userId){
    const user = HF.getUserById(userId);
    if(!user) return;
    if(action === 'verify'){
      HF.touchProfile(userId, { verified: true });
      HF.logAction && HF.logAction('Profile verified', 'Profile marked as verified from the admin dashboard.', {
        targetUserId: userId,
        userName: HF.getProfile(userId)?.fullName || user.username,
        role: HF.getCurrentUser()?.role,
      });
      HF.saveState();
      HF.renderAdminContent();
      return;
    }
    if(action === 'activate') return HF.setUserStatus(userId, 'active', 'Activated from the admin dashboard.');
    if(action === 'suspend') return HF.setUserStatus(userId, 'suspended', 'Suspended from the admin dashboard.');
    if(action === 'make-user') return HF.updateUserRole(userId, 'user', 'Admin account demoted to user.');
    if(action === 'delete'){
      confirm('Delete Account', 'Delete this account and all linked records?', 'Delete', () => {
        HF.deleteAccount(userId, 'Deleted from the admin dashboard.');
        HF.renderAdminContent();
      });
    }
  };

  HF.injectAdminTabs();

  const baseBindEvents = core.getFns().bindEvents;
  const baseCheckBadges = core.getFns().checkBadges;

  core.override({
    renderGoals: HF.renderGoals,
    openGoalModal: HF.openGoalModal,
    saveGoal: HF.saveGoal,
    renderJournal: HF.renderJournal,
    saveJournal: HF.saveJournal,
    renderBadges: HF.renderBadges,
    openAdmin: HF.openAdmin,
    renderAdminContent: HF.renderAdminContent,
    checkBadges: function(){
      const before = [...getBadges()];
      baseCheckBadges();
      const after = [...getBadges()];
      const newBadges = after.filter(id => !before.includes(id));
      const current = HF.getCurrentUser();
      if(current && newBadges.length){
        newBadges.forEach(badgeId => {
          HF.getDB().badgeHistory.push({
            id: core.helpers.uid(),
            userId: current.id,
            badgeId,
            action: 'earned',
            createdAt: Date.now(),
          });
        });
        HF.saveState();
      }
    },
    bindEvents: function(){
      baseBindEvents();

      $('goals-grid')?.addEventListener('click', event => {
        const actionEl = event.target.closest('[data-goal-action]');
        if(!actionEl) return;
        const action = actionEl.dataset.goalAction;
        const goalId = actionEl.dataset.goalId;
        if(action === 'edit') HF.openGoalModal(goalId);
        if(action === 'delete') HF.requestGoalDelete(goalId);
        if(action === 'save-progress'){
          const value = document.querySelector(`[data-goal-progress="${goalId}"]`)?.value;
          HF.requestGoalProgressUpdate(goalId, value);
        }
      });

      $('journal-grid')?.addEventListener('click', event => {
        const actionEl = event.target.closest('[data-journal-action]');
        if(!actionEl) return;
        const action = actionEl.dataset.journalAction;
        const dateKey = actionEl.dataset.journalDate;
        if(action === 'edit') core.getFns().openJournalModal(dateKey);
        if(action === 'delete') HF.requestJournalDelete(dateKey);
      });

      $('badges-grid')?.addEventListener('click', event => {
        const actionEl = event.target.closest('[data-badge-request]');
        if(!actionEl) return;
        HF.requestBadgeRemoval(actionEl.dataset.badgeRequest);
      });

      $('admin-content')?.addEventListener('click', event => {
        const reviewButton = event.target.closest('[data-request-review]');
        if(reviewButton){
          HF.openDecisionModal(reviewButton.dataset.requestReview, reviewButton.dataset.requestDecision);
          return;
        }

        const userButton = event.target.closest('[data-user-action]');
        if(userButton){
          HF.handleAdminUserAction(userButton.dataset.userAction, userButton.dataset.userId);
          return;
        }

        const goalButton = event.target.closest('[data-admin-goal-action]');
        if(goalButton){
          const userId = goalButton.dataset.goalUser;
          const goalId = goalButton.dataset.goalId;
          if(goalButton.dataset.adminGoalAction === 'save') HF.saveAdminGoal(userId, goalId);
          if(goalButton.dataset.adminGoalAction === 'delete'){
            HF.getDB().goals[userId] = (HF.getDB().goals[userId] || []).filter(goal => goal.id !== goalId);
            HF.saveState();
            HF.renderAdminContent();
          }
          return;
        }

        const badgeGrant = event.target.closest('[data-admin-badge-grant]');
        if(badgeGrant){
          HF.grantBadge($('admin-badge-user').value, $('admin-badge-id').value);
          return;
        }

        const badgeRemove = event.target.closest('[data-admin-badge-remove]');
        if(badgeRemove){
          HF.removeBadgeDirect(badgeRemove.dataset.badgeUser, badgeRemove.dataset.adminBadgeRemove);
          return;
        }

        const trackerApply = event.target.closest('[data-admin-record-apply]');
        if(trackerApply){
          HF.applyAdminTrackerOverride();
          return;
        }

        const openAnnouncement = event.target.closest('[data-open-announcement]');
        if(openAnnouncement){
          HF.openAnnouncementComposer();
        }
      });

      $('admin-content')?.addEventListener('input', event => {
        if(event.target.id === 'admin-search'){
          HF.adminState.search = event.target.value;
          HF.renderAdminContent();
        }
      });

      $('admin-content')?.addEventListener('change', event => {
        if(event.target.id === 'admin-status-filter'){
          HF.adminState.requestStatus = event.target.value;
          HF.renderAdminContent();
          return;
        }
        if(event.target.id === 'admin-type-filter'){
          HF.adminState.requestType = event.target.value;
          HF.renderAdminContent();
          return;
        }
        if(event.target.id === 'admin-record-user'){
          HF.adminState.recordUserId = event.target.value;
          HF.renderAdminContent();
          return;
        }
        if(event.target.matches('[data-permission-role][data-permission-key]')){
          HF.setPermission(event.target.dataset.permissionRole, event.target.dataset.permissionKey, event.target.checked);
          HF.renderAdminContent();
        }
      });
    },
  });
})();
