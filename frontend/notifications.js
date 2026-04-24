(function(){
  'use strict';

  const core = window.HFCore;
  const HF = window.HFMS = window.HFMS || {};
  if(!core || !HF.getDB) return;

  const { $, openM, closeM, toast } = core.helpers;

  HF.injectAnnouncementUI = function(){
    const nav = document.querySelector('.nav');
    const pageWrap = document.querySelector('.page-wrap');
    const topbar = document.querySelector('.topbar');

    if(nav && !nav.querySelector('[data-s="announcements"]')){
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'nav-i';
      link.dataset.s = 'announcements';
      link.innerHTML = '<span>Broadcast</span><span>Announcements</span>';
      nav.appendChild(link);
    }

    if(pageWrap && !document.getElementById('sec-announcements')){
      const section = document.createElement('section');
      section.id = 'sec-announcements';
      section.className = 'sec';
      section.innerHTML = `
        <div class="section-hdr">
          <div>
            <h2 class="sec-ttl">Announcements</h2>
            <div class="sec-sub">Global updates, user notices, and internal admin messages.</div>
          </div>
          <button class="btn btn-primary btn-sm hidden" id="btn-new-announcement">New Announcement</button>
        </div>
        <div id="announcement-center" class="announcement-center"></div>`;
      pageWrap.appendChild(section);
    }

    if(!document.getElementById('notif-panel')){
      const panel = document.createElement('div');
      panel.id = 'notif-panel';
      panel.className = 'notif-panel';
      panel.innerHTML = `
        <div class="notif-panel-head">
          <div>
            <div class="notif-panel-title">Notification Center</div>
            <div class="notif-panel-sub">Requests, approvals, and announcements</div>
          </div>
          <button class="btn btn-ghost btn-xs" id="notif-close">Close</button>
        </div>
        <div id="notif-list" class="notif-list"></div>`;
      (topbar || document.body).appendChild(panel);
    }

    if(!document.getElementById('announcement-modal')){
      const modal = document.createElement('div');
      modal.id = 'announcement-modal';
      modal.className = 'modal-overlay';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="modal-box modal-wide" role="dialog" aria-modal="true">
          <button class="modal-x" id="ann-x">X</button>
          <h3 class="modal-title">Announcement Composer</h3>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Audience</label>
              <select id="ann-audience" class="form-select">
                <option value="global">Global Announcement</option>
                <option value="user">User Specific</option>
                <option value="admin">Admin Only</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Target User</label>
              <select id="ann-target" class="form-select"></select>
            </div>
            <div class="form-group span-2">
              <label class="form-label">Title</label>
              <input type="text" id="ann-title" class="form-input" placeholder="Add a short headline"/>
            </div>
            <div class="form-group span-2">
              <label class="form-label">Message</label>
              <textarea id="ann-message" class="form-input" rows="4" placeholder="Write the announcement body." style="resize:vertical"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" id="ann-cancel">Cancel</button>
            <button class="btn btn-primary" id="ann-save">Send Announcement</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
  };

  HF.getNotifications = function(userId){
    const current = userId || HF.getCurrentUser()?.id;
    if(!current) return [];
    return HF.getDB().notifications[current] || [];
  };

  HF.notifyUser = function(userId, note){
    const DB = HF.getDB();
    if(!userId) return;
    if(!DB.notifications[userId]) DB.notifications[userId] = [];
    DB.notifications[userId].unshift({
      id: core.helpers.uid(),
      title: note.title || 'Notification',
      message: note.message || '',
      type: note.type || 'system',
      section: note.section || '',
      comment: note.comment || '',
      announcementId: note.announcementId || '',
      createdAt: Date.now(),
      readAt: null,
    });
    DB.notifications[userId] = DB.notifications[userId].slice(0, 100);
  };

  HF.notifyRole = function(roles, note){
    const roleSet = Array.isArray(roles) ? roles : [roles];
    HF.getDB().users
      .filter(user => roleSet.includes(user.role) && user.status === 'active')
      .forEach(user => HF.notifyUser(user.id, note));
  };

  HF.getVisibleAnnouncements = function(user){
    const current = user || HF.getCurrentUser();
    if(!current) return [];
    return HF.getDB().announcements.filter(item => {
      if(item.audience === 'global') return true;
      if(item.audience === 'admin') return HF.isAdmin(current);
      if(item.audience === 'user') return item.targetUserId === current.id;
      return false;
    }).sort((a, b) => b.createdAt - a.createdAt);
  };

  HF.createAnnouncement = function(data){
    const current = HF.getCurrentUser();
    if(!current) return;
    const announcement = {
      id: core.helpers.uid(),
      audience: data.audience,
      targetUserId: data.targetUserId || '',
      title: data.title,
      message: data.message,
      createdAt: Date.now(),
      createdById: current.id,
      createdByName: HF.getProfile(current.id)?.fullName || current.name,
      banner: true,
    };

    HF.getDB().announcements.unshift(announcement);

    if(announcement.audience === 'global'){
      HF.getDB().users.forEach(user => {
        if(user.status === 'active') HF.notifyUser(user.id, {
          title: announcement.title,
          message: announcement.message,
          type: 'announcement',
          section: 'announcements',
          announcementId: announcement.id,
        });
      });
    } else if(announcement.audience === 'admin'){
      HF.notifyRole(['super_admin', 'admin'], {
        title: announcement.title,
        message: announcement.message,
        type: 'announcement',
        section: 'announcements',
        announcementId: announcement.id,
      });
    } else if(announcement.audience === 'user' && announcement.targetUserId){
      HF.notifyUser(announcement.targetUserId, {
        title: announcement.title,
        message: announcement.message,
        type: 'announcement',
        section: 'announcements',
        announcementId: announcement.id,
      });
    }

    HF.logAction && HF.logAction('Announcement sent', announcement.title, {
      targetUserId: announcement.targetUserId || current.id,
      userName: announcement.createdByName,
      role: current.role,
      meta: { summary: announcement.message, audience: announcement.audience },
    });
    HF.saveState();
    HF.refreshAll();
    closeM('announcement-modal');
    toast('Announcement sent.');
  };

  HF.markNotificationRead = function(notificationId){
    const note = HF.getNotifications().find(item => item.id === notificationId);
    if(!note || note.readAt) return;
    note.readAt = Date.now();
    HF.saveState();
    HF.renderNotificationPanel();
  };

  HF.updateNotificationTargetOptions = function(){
    const select = $('ann-target');
    if(!select) return;
    const users = HF.getDB().users.filter(user => user.role === 'user' && user.status === 'active');
    select.innerHTML = users.map(user => {
      const profile = HF.getProfile(user.id);
      return `<option value="${user.id}">${HF.escape(profile?.fullName || user.name)} (${HF.escape(user.username)})</option>`;
    }).join('');
    select.disabled = $('ann-audience').value !== 'user';
  };

  HF.openAnnouncementComposer = function(){
    if(!(HF.hasPermission('sendGlobalAnnouncements') || HF.hasPermission('sendUserNotifications') || HF.hasPermission('sendAdminAnnouncements'))){
      toast('You do not have permission to send announcements.');
      return;
    }
    $('ann-title').value = '';
    $('ann-message').value = '';
    $('ann-audience').value = HF.hasPermission('sendGlobalAnnouncements') ? 'global' : 'user';
    HF.updateNotificationTargetOptions();
    openM('announcement-modal');
    setTimeout(() => $('ann-title').focus(), 40);
  };

  HF.renderNotificationPanel = function(){
    const panel = $('notif-panel');
    const list = $('notif-list');
    const dot = $('notif-dot');
    if(!panel || !list) return;

    const notifications = HF.getNotifications();
    const announcements = HF.getVisibleAnnouncements().slice(0, 3).map(item => ({
      id: `announcement-${item.id}`,
      title: item.title,
      message: item.message,
      type: 'announcement',
      section: 'announcements',
      createdAt: item.createdAt,
      readAt: null,
      synthetic: true,
    }));
    const merged = [...notifications, ...announcements]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12);

    const unread = notifications.filter(note => !note.readAt).length;
    if(dot) dot.hidden = unread === 0;

    if(!merged.length){
      list.innerHTML = '<div class="empty-msg" style="padding:24px">No notifications yet.</div>';
      return;
    }

    list.innerHTML = merged.map(note => `
      <button class="notif-item ${note.readAt ? '' : 'unread'}" data-notif-id="${note.id}" data-notif-section="${note.section || ''}">
        <div class="notif-item-head">
          <span class="notif-type">${HF.escape(note.type)}</span>
          <span class="notif-time">${HF.nowLabel(note.createdAt)}</span>
        </div>
        <div class="notif-item-title">${HF.escape(note.title)}</div>
        <div class="notif-item-body">${HF.escape(note.message)}</div>
        ${note.comment ? `<div class="notif-item-comment">${HF.escape(note.comment)}</div>` : ''}
      </button>`).join('');
  };

  HF.toggleNotificationPanel = function(){
    const panel = $('notif-panel');
    if(!panel) return;
    panel.classList.toggle('open');
    HF.renderNotificationPanel();
  };

  HF.renderAnnouncementCenter = function(){
    const center = $('announcement-center');
    const button = $('btn-new-announcement');
    if(!center) return;
    if(button){
      button.classList.toggle('hidden', !(HF.hasPermission('sendGlobalAnnouncements') || HF.hasPermission('sendUserNotifications') || HF.hasPermission('sendAdminAnnouncements')));
    }

    const announcements = HF.getVisibleAnnouncements();
    if(!announcements.length){
      center.innerHTML = '<div class="empty-msg">No announcements available for this profile yet.</div>';
      return;
    }

    center.innerHTML = announcements.map(item => `
      <article class="announcement-card">
        <div class="announcement-top">
          <div>
            <div class="announcement-title">${HF.escape(item.title)}</div>
            <div class="announcement-meta">${HF.escape(item.createdByName || 'System')} · ${HF.nowLabel(item.createdAt)}</div>
          </div>
          <div class="announcement-tags">
            <span class="status-pill status-${HF.escape(item.audience)}">${HF.escape(item.audience)}</span>
          </div>
        </div>
        <p class="announcement-body">${HF.escape(item.message)}</p>
      </article>`).join('');
  };

  HF.renderDashboardBanner = function(){
    const banner = $('moti-banner');
    const current = HF.getCurrentUser();
    if(!banner || !current) return;

    const profile = HF.getProfile(current.id);
    const latestAnnouncement = HF.getVisibleAnnouncements(current)[0];

    if(latestAnnouncement){
      banner.classList.remove('hidden');
      banner.classList.add('announcement-banner');
      banner.innerHTML = `
        <div class="banner-title">${HF.escape(latestAnnouncement.title)}</div>
        <div class="banner-copy">${HF.escape(latestAnnouncement.message)}</div>`;
      return;
    }

    if(profile && !HF.isProfileComplete(profile)){
      banner.classList.remove('hidden');
      banner.classList.add('announcement-banner');
      banner.innerHTML = `
        <div class="banner-title">Complete your profile</div>
        <div class="banner-copy">Finish your profile details so approvals, records, and notifications stay linked to the right identity.</div>`;
      return;
    }

    banner.classList.add('hidden');
    banner.innerHTML = '';
  };

  HF.injectAnnouncementUI();

  const baseBindEvents = core.getFns().bindEvents;

  core.override({
    reqNotif: function(){
      HF.toggleNotificationPanel();
    },
    bindEvents: function(){
      baseBindEvents();

      $('notif-close')?.addEventListener('click', () => $('notif-panel')?.classList.remove('open'));
      $('btn-new-announcement')?.addEventListener('click', HF.openAnnouncementComposer);
      $('ann-x')?.addEventListener('click', () => closeM('announcement-modal'));
      $('ann-cancel')?.addEventListener('click', () => closeM('announcement-modal'));
      $('ann-audience')?.addEventListener('change', HF.updateNotificationTargetOptions);
      $('ann-save')?.addEventListener('click', () => {
        const title = $('ann-title').value.trim();
        const message = $('ann-message').value.trim();
        const audience = $('ann-audience').value;
        const targetUserId = $('ann-target').value;
        if(!title || !message){
          toast('Title and message are required.');
          return;
        }
        if(audience === 'user' && !targetUserId){
          toast('Select a user for this announcement.');
          return;
        }
        HF.createAnnouncement({ title, message, audience, targetUserId });
      });

      $('notif-list')?.addEventListener('click', event => {
        const item = event.target.closest('[data-notif-id]');
        if(!item) return;
        const id = item.dataset.notifId;
        const section = item.dataset.notifSection;
        if(!id.startsWith('announcement-')) HF.markNotificationRead(id);
        if(section) core.getFns().goTo(section);
        $('notif-panel')?.classList.remove('open');
      });

      document.addEventListener('click', event => {
        const panel = $('notif-panel');
        const button = $('notif-btn');
        if(!panel || !panel.classList.contains('open')) return;
        if(panel.contains(event.target) || button?.contains(event.target)) return;
        panel.classList.remove('open');
      });
    },
  });
})();
