(function(){
  'use strict';

  const core = window.HFCore;
  const HF = window.HFMS = window.HFMS || {};
  if(!core || !HF.getDB) return;

  const { uid } = core.helpers;

  HF.logAction = function(action, comment, details){
    const DB = HF.getDB();
    const meta = details || {};
    const actor = meta.actor || HF.getCurrentUser() || null;
    const actorProfile = actor ? HF.getProfile(actor.id) : null;
    const entry = {
      id: uid(),
      userId: meta.userId || actor?.id || null,
      userName: meta.userName || actorProfile?.fullName || actor?.name || meta.fallbackName || 'Guest',
      role: meta.role || actor?.role || meta.fallbackRole || 'guest',
      targetUserId: meta.targetUserId || actor?.id || null,
      action,
      comment: comment || '',
      createdAt: Date.now(),
      meta: meta.meta || {},
    };

    DB.auditLogs.unshift(entry);
    DB.auditLogs = DB.auditLogs.slice(0, 2500);

    DB.changeLogs.push({
      at: entry.createdAt,
      username: entry.userName,
      action: comment ? `${action}: ${comment}` : action,
    });
    DB.changeLogs = DB.changeLogs.slice(-2500);

    return entry;
  };

  HF.getAuditLogs = function(filters){
    const DB = HF.getDB();
    const input = filters || {};
    const search = String(input.search || '').trim().toLowerCase();
    const role = input.role || '';
    return DB.auditLogs.filter(entry => {
      if(role && entry.role !== role) return false;
      if(!search) return true;
      return [
        entry.userName,
        entry.role,
        entry.action,
        entry.comment,
        entry.meta?.summary,
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(search));
    });
  };

  HF.renderLogRows = function(logs){
    const rows = logs || [];
    if(!rows.length){
      return '<div class="empty-msg">No audit records match the current filter.</div>';
    }

    return `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Date</th>
              <th>Time</th>
              <th>Action</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(entry => {
              const stamp = new Date(entry.createdAt);
              return `
                <tr>
                  <td>${HF.escape(entry.userName)}</td>
                  <td>${HF.renderRolePill(entry.role)}</td>
                  <td>${stamp.toLocaleDateString('en-US')}</td>
                  <td>${stamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</td>
                  <td>${HF.escape(entry.action)}</td>
                  <td>${HF.escape(entry.comment || '-')}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  };
})();
