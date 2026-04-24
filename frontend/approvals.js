(function(){
  'use strict';

  const core = window.HFCore;
  const HF = window.HFMS = window.HFMS || {};
  if(!core || !HF.getDB) return;

  const helpers = core.helpers;
  const { $, $q, uid, rk, openM, closeM, toast, confirm, isPast, isToday } = helpers;

  HF.requestLabels = {
    tracker_override: 'Tracker Override',
    profile_update: 'Profile Update',
    profile_delete: 'Profile Delete',
    goal_update: 'Goal Update',
    goal_delete: 'Goal Delete',
    journal_update: 'Journal Update',
    journal_delete: 'Journal Delete',
    badge_remove: 'Badge Removal',
    admin_account: 'Admin Account Request',
  };

  HF.requestDraft = null;
  HF.requestDecision = null;

  HF.injectApprovalUI = function(){
    if($('request-modal')) return;
    const app = $('app');
    if(!app) return;

    const requestModal = document.createElement('div');
    requestModal.id = 'request-modal';
    requestModal.className = 'modal-overlay';
    requestModal.setAttribute('aria-hidden', 'true');
    requestModal.innerHTML = `
      <div class="modal-box modal-wide" role="dialog" aria-modal="true">
        <button class="modal-x" id="rq-x">X</button>
        <div class="modal-icon">Request</div>
        <h3 class="modal-title" id="rq-title">Submit Request</h3>
        <p class="modal-sub" id="rq-sub">Add a reason so an admin can review this change.</p>
        <div id="rq-summary" class="request-summary"></div>
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Reason / Comment *</label>
          <textarea id="rq-reason" class="form-input" rows="4" placeholder="Explain why this change is needed." style="resize:vertical"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="rq-cancel">Cancel</button>
          <button class="btn btn-primary" id="rq-submit">Submit Request</button>
        </div>
      </div>`;

    const decisionModal = document.createElement('div');
    decisionModal.id = 'approval-action-modal';
    decisionModal.className = 'modal-overlay';
    decisionModal.setAttribute('aria-hidden', 'true');
    decisionModal.innerHTML = `
      <div class="modal-box modal-wide" role="dialog" aria-modal="true">
        <button class="modal-x" id="ra-x">X</button>
        <div class="modal-icon">Review</div>
        <h3 class="modal-title" id="ra-title">Review Request</h3>
        <p class="modal-sub" id="ra-sub">Add a comment for the record before completing this action.</p>
        <div id="ra-summary" class="request-summary"></div>
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Admin Comment *</label>
          <textarea id="ra-comment" class="form-input" rows="4" placeholder="Explain why you approved or rejected this request." style="resize:vertical"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="ra-cancel">Cancel</button>
          <button class="btn btn-primary" id="ra-submit">Save Decision</button>
        </div>
      </div>`;

    app.appendChild(requestModal);
    app.appendChild(decisionModal);
  };

  HF.getRequests = function(filters){
    const DB = HF.getDB();
    const input = filters || {};
    const search = String(input.search || '').trim().toLowerCase();
    const status = input.status || '';
    const type = input.type || '';
    return DB.requests.filter(request => {
      if(status && request.status !== status) return false;
      if(type && request.type !== type) return false;
      if(!search) return true;
      return [
        request.title,
        request.summary,
        request.requestedByName,
        request.reason,
        request.responseComment,
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(search));
    }).sort((a, b) => b.createdAt - a.createdAt);
  };

  HF.renderRequestStatus = function(status){
    return `<span class="status-pill status-${HF.escape(status || 'pending')}">${HF.escape((status || 'pending').replace(/_/g, ' '))}</span>`;
  };

  HF.renderRequestTable = function(filters){
    const requests = HF.getRequests(filters);
    if(!requests.length){
      return '<div class="empty-msg">No requests match the current filter.</div>';
    }

    return `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>User</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Admin Comment</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(request => `
              <tr>
                <td>
                  <div class="table-title">${HF.escape(HF.requestLabels[request.type] || request.title)}</div>
                  <div class="table-sub">${HF.escape(request.summary || request.title)}</div>
                </td>
                <td>
                  <div>${HF.escape(request.requestedByName || '-')}</div>
                  <div class="table-sub">${HF.renderRolePill(request.requestedByRole || 'user')}</div>
                </td>
                <td>${HF.renderRequestStatus(request.status)}</td>
                <td>${HF.escape(request.reason || '-')}</td>
                <td>${HF.escape(request.responseComment || '-')}</td>
                <td>${HF.nowLabel(request.createdAt)}</td>
                <td>
                  ${request.status === 'pending' ? `
                    <div class="table-actions">
                      <button class="btn btn-primary btn-sm" data-request-review="${request.id}" data-request-decision="approved">Approve</button>
                      <button class="btn btn-danger btn-sm" data-request-review="${request.id}" data-request-decision="rejected">Reject</button>
                    </div>` : '<span class="table-sub">Completed</span>'}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  };

  HF.createRequest = function(data){
    const DB = HF.getDB();
    const currentUser = HF.getCurrentUser();
    const currentProfile = currentUser ? HF.getProfile(currentUser.id) : null;
    const request = {
      id: uid(),
      type: data.type,
      title: data.title || HF.requestLabels[data.type] || 'Request',
      summary: data.summary || '',
      resourceType: data.resourceType || 'record',
      resourceId: data.resourceId || '',
      targetUserId: data.targetUserId || currentUser?.id || null,
      requestedById: data.requestedById || currentUser?.id || null,
      requestedByName: data.requestedByName || currentProfile?.fullName || currentUser?.name || 'Guest',
      requestedByRole: data.requestedByRole || currentUser?.role || 'guest',
      reason: data.reason || '',
      requestComment: data.reason || '',
      responseComment: '',
      status: 'pending',
      payload: data.payload || {},
      currentValue: data.currentValue || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    DB.requests.push(request);
    HF.logAction && HF.logAction('Request submitted', request.reason || request.title, {
      targetUserId: request.targetUserId,
      userName: request.requestedByName,
      role: request.requestedByRole,
      meta: { summary: request.summary, type: request.type },
    });
    HF.notifyRole && HF.notifyRole(['super_admin', 'admin'], {
      title: request.title,
      message: `${request.requestedByName} submitted a request for review.`,
      type: 'request',
      section: 'admin',
    });
    HF.saveState();
    return request;
  };

  HF.openRequestModal = function(data){
    HF.requestDraft = data;
    $('rq-title').textContent = data.title || 'Submit Request';
    $('rq-sub').textContent = data.subtitle || 'Add a reason so an admin can review this change.';
    $('rq-summary').innerHTML = `
      <div class="request-summary-row">
        <span>Request Type</span>
        <strong>${HF.escape(HF.requestLabels[data.type] || data.type)}</strong>
      </div>
      ${data.summary ? `<div class="request-summary-row"><span>Summary</span><strong>${HF.escape(data.summary)}</strong></div>` : ''}
      ${data.context ? `<div class="request-summary-note">${HF.escape(data.context)}</div>` : ''}`;
    $('rq-reason').value = '';
    openM('request-modal');
    setTimeout(() => $('rq-reason').focus(), 40);
  };

  HF.submitDraftRequest = function(){
    const reason = $('rq-reason').value.trim();
    if(!reason){
      toast('Reason is required.');
      return;
    }
    if(!HF.requestDraft) return;
    const request = HF.createRequest({
      ...HF.requestDraft,
      reason,
    });
    HF.requestDraft = null;
    closeM('request-modal');
    toast('Request submitted for approval.');
    if(HF.renderAdminDashboard) HF.renderAdminDashboard();
    if(HF.renderProfileSection) HF.renderProfileSection();
    if(HF.renderNotificationPanel) HF.renderNotificationPanel();
    return request;
  };

  HF.openDecisionModal = function(requestId, decision){
    const request = HF.getDB().requests.find(item => item.id === requestId);
    if(!request) return;
    HF.requestDecision = { requestId, decision };
    $('ra-title').textContent = decision === 'approved' ? 'Approve Request' : 'Reject Request';
    $('ra-sub').textContent = 'Add a comment for the permanent record.';
    $('ra-summary').innerHTML = `
      <div class="request-summary-row">
        <span>Request</span>
        <strong>${HF.escape(request.title)}</strong>
      </div>
      <div class="request-summary-row">
        <span>Requested By</span>
        <strong>${HF.escape(request.requestedByName)}</strong>
      </div>
      <div class="request-summary-note">${HF.escape(request.reason || '')}</div>`;
    $('ra-comment').value = '';
    $('ra-submit').textContent = decision === 'approved' ? 'Approve Request' : 'Reject Request';
    $('ra-submit').className = decision === 'approved' ? 'btn btn-primary' : 'btn btn-danger';
    openM('approval-action-modal');
    setTimeout(() => $('ra-comment').focus(), 40);
  };

  HF.applyRequest = function(request){
    const DB = HF.getDB();
    switch(request.type){
      case 'tracker_override': {
        const payload = request.payload || {};
        const userId = payload.userId || request.targetUserId;
        if(!DB.records[userId]) DB.records[userId] = {};
        const key = rk(payload.habitId, payload.year, payload.month, payload.day);
        if(payload.value === 0) delete DB.records[userId][key];
        else DB.records[userId][key] = payload.value;
        DB.trackerHistory.push({
          id: uid(),
          userId,
          habitId: payload.habitId,
          value: payload.value,
          createdAt: Date.now(),
          requestId: request.id,
        });
        break;
      }
      case 'goal_update': {
        const payload = request.payload || {};
        const userId = request.targetUserId;
        const goals = DB.goals[userId] || [];
        const index = goals.findIndex(goal => goal.id === payload.goal.id);
        if(index >= 0) goals[index] = { ...goals[index], ...payload.goal };
        DB.goalHistory.push({
          id: uid(),
          userId,
          goalId: payload.goal.id,
          createdAt: Date.now(),
          requestId: request.id,
          action: 'updated',
        });
        break;
      }
      case 'goal_delete': {
        const payload = request.payload || {};
        const userId = request.targetUserId;
        DB.goals[userId] = (DB.goals[userId] || []).filter(goal => goal.id !== payload.goalId);
        DB.goalHistory.push({
          id: uid(),
          userId,
          goalId: payload.goalId,
          createdAt: Date.now(),
          requestId: request.id,
          action: 'deleted',
        });
        break;
      }
      case 'journal_update': {
        const payload = request.payload || {};
        const userId = request.targetUserId;
        if(!DB.journal[userId]) DB.journal[userId] = {};
        DB.journal[userId][payload.dateKey] = payload.entry;
        break;
      }
      case 'journal_delete': {
        const payload = request.payload || {};
        const userId = request.targetUserId;
        if(DB.journal[userId]) delete DB.journal[userId][payload.dateKey];
        break;
      }
      case 'profile_update': {
        const payload = request.payload || {};
        const userId = request.targetUserId;
        const profile = HF.getProfile(userId) || HF.buildProfileFromUser(HF.getUserById(userId));
        DB.profiles[userId] = {
          ...profile,
          ...(payload.profile || {}),
          allowDirectEdit: false,
          updatedAt: Date.now(),
        };
        const user = HF.getUserById(userId);
        if(user){
          user.name = DB.profiles[userId].fullName || user.name;
          if(payload.profile?.username) user.username = payload.profile.username;
          if(payload.password) user.password = payload.password;
          user.updatedAt = Date.now();
        }
        break;
      }
      case 'profile_delete': {
        HF.deleteAccount(request.targetUserId, 'Approved account deletion request.');
        break;
      }
      case 'badge_remove': {
        const payload = request.payload || {};
        const userId = request.targetUserId;
        DB.earnedBadges[userId] = (DB.earnedBadges[userId] || []).filter(badgeId => badgeId !== payload.badgeId);
        DB.badgeHistory.push({
          id: uid(),
          userId,
          badgeId: payload.badgeId,
          action: 'removed',
          createdAt: Date.now(),
          requestId: request.id,
        });
        break;
      }
      case 'admin_account': {
        const payload = request.payload || {};
        const userData = payload.user || {};
        if(HF.getDB().users.some(user => user.username === userData.username)) break;
        DB.users.push({
          id: userData.id || uid(),
          name: userData.name,
          username: userData.username,
          password: userData.password,
          role: 'admin',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        const newUser = DB.users[DB.users.length - 1];
        DB.profiles[newUser.id] = {
          ...(payload.profile || {}),
          id: newUser.id,
          username: newUser.username,
          fullName: payload.profile?.fullName || newUser.name,
          status: 'active',
          verified: true,
          allowDirectEdit: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        HF.ensureUserContainers(newUser.id);
        if(!DB.notifications[newUser.id]) DB.notifications[newUser.id] = [];
        HF.logAction && HF.logAction('Admin created', 'Admin account approved and created.', {
          targetUserId: newUser.id,
          userName: newUser.name,
          role: 'admin',
        });
        break;
      }
      default:
        break;
    }
  };

  HF.decideRequest = function(requestId, decision, comment){
    const request = HF.getDB().requests.find(item => item.id === requestId);
    const reviewer = HF.getCurrentUser();
    if(!request || !reviewer) return;
    request.status = decision;
    request.responseComment = comment;
    request.reviewedById = reviewer.id;
    request.reviewedByName = HF.getProfile(reviewer.id)?.fullName || reviewer.name;
    request.reviewedByRole = reviewer.role;
    request.reviewedAt = Date.now();
    request.updatedAt = Date.now();

    if(decision === 'approved') HF.applyRequest(request);

    HF.logAction && HF.logAction(
      decision === 'approved' ? 'Request approved' : 'Request rejected',
      comment,
      {
        targetUserId: request.targetUserId,
        userName: request.requestedByName,
        role: request.requestedByRole,
        meta: { summary: request.summary, type: request.type },
      }
    );

    if(request.targetUserId && HF.notifyUser){
      HF.notifyUser(request.targetUserId, {
        title: decision === 'approved' ? 'Request approved' : 'Request rejected',
        message: `${request.title} was ${decision}.`,
        type: 'request',
        section: 'profile',
        comment,
      });
    }

    HF.saveState();
    HF.refreshAll();
    closeM('approval-action-modal');
    toast(`Request ${decision}.`);
  };

  HF.requestPastTrackerChange = function(config){
    const habits = helpers.getHabits();
    const habit = habits.find(item => item.id === config.habitId);
    const label = helpers.fmtDateKey(`${config.year}_${String(config.month + 1).padStart(2, '0')}_${String(config.day).padStart(2, '0')}`);
    HF.openRequestModal({
      type: 'tracker_override',
      title: 'Request Tracker Override',
      summary: `${habit ? habit.name : 'Habit'} on ${label}`,
      context: 'Past tracker records require admin approval. Add a reason for the change.',
      targetUserId: HF.getCurrentUser().id,
      payload: {
        userId: HF.getCurrentUser().id,
        habitId: config.habitId,
        year: config.year,
        month: config.month,
        day: config.day,
        value: config.value,
      },
    });
  };

  HF.injectApprovalUI();

  const baseHandleCellClick = core.getFns().handleCellClick;
  const baseBindEvents = core.getFns().bindEvents;

  core.override({
    handleCellClick: function(event){
      const cell = event.target.closest('.dc');
      if(!cell) return baseHandleCellClick(event);

      const currentUser = HF.getCurrentUser();
      if(!currentUser) return baseHandleCellClick(event);

      const month = HF.getAppState().selMonth;
      const year = HF.getAppState().selYear;
      const day = Number(cell.dataset.d);
      const habitId = cell.dataset.hid;

      if(isPast(year, month, day) && !isToday(year, month, day)){
        const currentValue = helpers.getRec(habitId, year, month, day);
        const nextValue = (currentValue + 1) % 4;
        if(HF.hasPermission('trackerOverrides')){
          helpers.setRec(habitId, year, month, day, nextValue);
          HF.logAction && HF.logAction('Tracker override', 'Past tracker value updated from the tracker view.', {
            targetUserId: currentUser.id,
            userName: HF.getProfile(currentUser.id)?.fullName || currentUser.username,
            role: currentUser.role,
          });
          HF.saveState();
          core.getFns().renderTracker();
          core.getFns().updateDashboard();
          return;
        }

        HF.requestPastTrackerChange({
          habitId,
          year,
          month,
          day,
          value: nextValue,
        });
        return;
      }

      return baseHandleCellClick(event);
    },
    bindEvents: function(){
      baseBindEvents();

      $('rq-x')?.addEventListener('click', () => closeM('request-modal'));
      $('rq-cancel')?.addEventListener('click', () => closeM('request-modal'));
      $('rq-submit')?.addEventListener('click', HF.submitDraftRequest);

      $('ra-x')?.addEventListener('click', () => closeM('approval-action-modal'));
      $('ra-cancel')?.addEventListener('click', () => closeM('approval-action-modal'));
      $('ra-submit')?.addEventListener('click', () => {
        const comment = $('ra-comment').value.trim();
        if(!comment){
          toast('Admin comment is required.');
          return;
        }
        if(!HF.requestDecision) return;
        HF.decideRequest(HF.requestDecision.requestId, HF.requestDecision.decision, comment);
        HF.requestDecision = null;
      });
    },
  });
})();
