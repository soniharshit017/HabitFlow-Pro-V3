(function(){
  'use strict';

  const core = window.HFCore;
  const HF = window.HFMS = window.HFMS || {};
  if(!core || !HF.getDB) return;

  const { $, openM, closeM, toast } = core.helpers;

  HF.readFileAsDataUrl = function(file){
    return new Promise(resolve => {
      if(!file){
        resolve('');
        return;
      }
      const reader = new FileReader();
      reader.onload = event => resolve(String(event.target.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  HF.injectProfileUI = function(){
    const authCard = document.querySelector('.auth-card');
    const register = $('tab-register');
    const nav = document.querySelector('.nav');
    const pageWrap = document.querySelector('.page-wrap');
    const app = $('app');
    const hint = document.querySelector('.auth-hint');

    if(authCard) authCard.classList.add('auth-card-wide');

    if(hint){
      hint.innerHTML = 'Default Super Admin: <strong>admin / admin123</strong><br/>Default User: <strong>user / user123</strong>';
    }

    if(register){
      register.innerHTML = `
        <div class="form-grid-2 auth-register-grid">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input type="text" id="reg-name" class="form-input" placeholder="Your full name"/>
          </div>
          <div class="form-group">
            <label class="form-label">Username *</label>
            <input type="text" id="reg-user" class="form-input" placeholder="Choose a username"/>
          </div>
          <div class="form-group">
            <label class="form-label">Mobile Number *</label>
            <input type="tel" id="reg-mobile" class="form-input" placeholder="Mobile number"/>
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" id="reg-email" class="form-input" placeholder="Email address"/>
          </div>
          <div class="form-group">
            <label class="form-label">Password *</label>
            <input type="password" id="reg-pass" class="form-input" placeholder="Choose a password"/>
          </div>
          <div class="form-group">
            <label class="form-label">Profile Photo *</label>
            <input type="file" id="reg-photo" class="form-input" accept="image/*"/>
          </div>
          <div class="form-group span-2">
            <label class="form-label">Address *</label>
            <textarea id="reg-address" class="form-input" rows="2" placeholder="Current address" style="resize:vertical"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Birth Date *</label>
            <input type="date" id="reg-birth" class="form-input"/>
          </div>
          <div class="form-group">
            <label class="form-label">Gender</label>
            <select id="reg-gender" class="form-select">
              <option value="">Prefer not to say</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Emergency Contact</label>
            <input type="text" id="reg-emergency" class="form-input" placeholder="Emergency contact"/>
          </div>
          <div class="form-group">
            <label class="form-label">Occupation *</label>
            <input type="text" id="reg-occupation" class="form-input" placeholder="Occupation"/>
          </div>
          <div class="form-group span-2">
            <label class="form-label">Notes / About Me *</label>
            <textarea id="reg-about" class="form-input" rows="3" placeholder="Tell us about yourself" style="resize:vertical"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Account Type</label>
            <select id="reg-role-choice" class="form-select">
              <option value="user">Create User Account</option>
              <option value="admin">Request Admin Account</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Admin Request Note</label>
            <input type="text" id="reg-admin-note" class="form-input" placeholder="Why do you need admin access?"/>
          </div>
        </div>
        <div id="reg-err" class="auth-err hidden"></div>
        <button class="btn btn-primary w-full" id="btn-register">Create Profile</button>`;
    }

    if(nav && !nav.querySelector('[data-s="profile"]')){
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'nav-i';
      link.dataset.s = 'profile';
      link.innerHTML = '<span>Profile</span><span>Profile</span>';
      nav.appendChild(link);
    }

    if(pageWrap && !document.getElementById('sec-profile')){
      const section = document.createElement('section');
      section.id = 'sec-profile';
      section.className = 'sec';
      section.innerHTML = `
        <div class="section-hdr">
          <div>
            <h2 class="sec-ttl">Profile Control</h2>
            <div class="sec-sub">Identity, verification, ownership, and approval history.</div>
          </div>
          <div class="profile-actions">
            <button class="btn btn-primary btn-sm" id="btn-edit-profile">Edit Profile</button>
            <button class="btn btn-danger btn-sm" id="btn-delete-profile">Request Delete</button>
          </div>
        </div>
        <div id="profile-section" class="profile-section"></div>`;
      pageWrap.appendChild(section);
    }

    if(app && !document.getElementById('profile-modal')){
      const modal = document.createElement('div');
      modal.id = 'profile-modal';
      modal.className = 'modal-overlay';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="modal-box modal-wide" role="dialog" aria-modal="true">
          <button class="modal-x" id="pf-x">X</button>
          <h3 class="modal-title" id="pf-title">Profile Editor</h3>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="pf-name" class="form-input"/>
            </div>
            <div class="form-group">
              <label class="form-label">Username *</label>
              <input type="text" id="pf-username" class="form-input"/>
            </div>
            <div class="form-group">
              <label class="form-label">Mobile Number *</label>
              <input type="tel" id="pf-mobile" class="form-input"/>
            </div>
            <div class="form-group">
              <label class="form-label">Email *</label>
              <input type="email" id="pf-email" class="form-input"/>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="pf-password" class="form-input" placeholder="Leave blank to keep current password"/>
            </div>
            <div class="form-group">
              <label class="form-label">Profile Photo</label>
              <input type="file" id="pf-photo" class="form-input" accept="image/*"/>
            </div>
            <div class="form-group span-2">
              <label class="form-label">Address *</label>
              <textarea id="pf-address" class="form-input" rows="2" style="resize:vertical"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Birth Date *</label>
              <input type="date" id="pf-birth" class="form-input"/>
            </div>
            <div class="form-group">
              <label class="form-label">Gender</label>
              <select id="pf-gender" class="form-select">
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Emergency Contact</label>
              <input type="text" id="pf-emergency" class="form-input"/>
            </div>
            <div class="form-group">
              <label class="form-label">Occupation *</label>
              <input type="text" id="pf-occupation" class="form-input"/>
            </div>
            <div class="form-group span-2">
              <label class="form-label">Notes / About Me *</label>
              <textarea id="pf-about" class="form-input" rows="3" style="resize:vertical"></textarea>
            </div>
          </div>
          <div id="pf-help" class="profile-form-note"></div>
          <div class="modal-footer">
            <button class="btn btn-ghost" id="pf-cancel">Cancel</button>
            <button class="btn btn-primary" id="pf-save">Save Profile</button>
          </div>
        </div>`;
      app.appendChild(modal);
    }
  };

  HF.collectRegistrationData = async function(){
    const photo = $('reg-photo').files[0];
    return {
      fullName: $('reg-name').value.trim(),
      username: $('reg-user').value.trim(),
      mobileNumber: $('reg-mobile').value.trim(),
      email: $('reg-email').value.trim(),
      password: $('reg-pass').value.trim(),
      profilePhoto: await HF.readFileAsDataUrl(photo),
      address: $('reg-address').value.trim(),
      birthDate: $('reg-birth').value,
      gender: $('reg-gender').value,
      emergencyContact: $('reg-emergency').value.trim(),
      occupation: $('reg-occupation').value.trim(),
      aboutMe: $('reg-about').value.trim(),
      roleChoice: $('reg-role-choice').value,
      adminNote: $('reg-admin-note').value.trim(),
    };
  };

  HF.validateProfilePayload = function(payload, isRegistration){
    const required = [
      ['fullName', 'Full name'],
      ['username', 'Username'],
      ['mobileNumber', 'Mobile number'],
      ['email', 'Email'],
      ['address', 'Address'],
      ['birthDate', 'Birth date'],
      ['occupation', 'Occupation'],
      ['aboutMe', 'About me'],
    ];

    if(isRegistration) required.push(['password', 'Password']);
    const missing = required.find(([key]) => !String(payload[key] || '').trim());
    if(missing) return `${missing[1]} is required.`;
    if(isRegistration && !payload.profilePhoto) return 'Profile photo is required.';
    if(payload.roleChoice === 'admin' && !payload.adminNote) return 'Add an admin request note.';
    return '';
  };

  HF.usernameExists = function(username, excludeUserId){
    const lower = String(username || '').trim().toLowerCase();
    return HF.getDB().users.some(user => user.id !== excludeUserId && user.username.toLowerCase() === lower);
  };

  HF.profileFieldExists = function(field, value, excludeUserId){
    const lower = String(value || '').trim().toLowerCase();
    if(!lower) return false;
    return HF.getDB().users.some(user => {
      if(user.id === excludeUserId) return false;
      const profile = HF.getProfile(user.id);
      return String(profile?.[field] || '').trim().toLowerCase() === lower;
    });
  };

  HF.pendingAdminExists = function(payload){
    const username = String(payload.username || '').trim().toLowerCase();
    const email = String(payload.email || '').trim().toLowerCase();
    return HF.getDB().requests.some(request => {
      if(request.type !== 'admin_account' || request.status === 'rejected') return false;
      const pendingUser = request.payload?.user || {};
      const pendingProfile = request.payload?.profile || {};
      return String(pendingUser.username || '').trim().toLowerCase() === username
        || String(pendingProfile.email || '').trim().toLowerCase() === email;
    });
  };

  HF.createDirectUser = function(payload){
    const DB = HF.getDB();
    const id = core.helpers.uid();
    const user = {
      id,
      name: payload.fullName,
      username: payload.username,
      password: payload.password,
      role: 'user',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    DB.users.push(user);
    DB.profiles[id] = {
      id,
      fullName: payload.fullName,
      username: payload.username,
      mobileNumber: payload.mobileNumber,
      email: payload.email,
      address: payload.address,
      birthDate: payload.birthDate,
      gender: payload.gender,
      emergencyContact: payload.emergencyContact,
      occupation: payload.occupation,
      aboutMe: payload.aboutMe,
      profilePhoto: payload.profilePhoto,
      verified: false,
      status: 'active',
      allowDirectEdit: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    HF.ensureUserContainers(id);
    if(HF.notifyUser){
      HF.notifyUser(id, {
        title: 'Welcome to HabitFlow Pro',
        message: 'Your profile is live. Admins can now review future sensitive change requests.',
        type: 'welcome',
        section: 'profile',
      });
    }
    HF.logAction && HF.logAction('Account created', 'New user profile created from registration.', {
      targetUserId: id,
      userName: payload.fullName,
      role: 'user',
    });
    HF.saveState();
    return user;
  };

  HF.requestAdminRegistration = function(payload){
    const pendingId = core.helpers.uid();
    HF.createRequest({
      type: 'admin_account',
      title: 'Admin account request',
      summary: `${payload.fullName} wants admin access.`,
      requestedById: null,
      requestedByName: payload.fullName,
      requestedByRole: 'guest',
      targetUserId: null,
      payload: {
        user: {
          id: pendingId,
          name: payload.fullName,
          username: payload.username,
          password: payload.password,
        },
        profile: {
          fullName: payload.fullName,
          username: payload.username,
          mobileNumber: payload.mobileNumber,
          email: payload.email,
          address: payload.address,
          birthDate: payload.birthDate,
          gender: payload.gender,
          emergencyContact: payload.emergencyContact,
          occupation: payload.occupation,
          aboutMe: payload.aboutMe,
          profilePhoto: payload.profilePhoto,
        },
      },
      reason: payload.adminNote,
    });
  };

  HF.renderProfileSection = function(){
    const section = $('profile-section');
    const current = HF.getCurrentUser();
    if(!section || !current) return;
    const profile = HF.getProfile(current.id);
    const requests = HF.getDB().requests
      .filter(request => request.targetUserId === current.id || request.requestedById === current.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6);

    const rows = [
      ['Mobile', profile?.mobileNumber],
      ['Email', profile?.email],
      ['Address', profile?.address],
      ['Birth Date', profile?.birthDate],
      ['Gender', profile?.gender || 'Not set'],
      ['Emergency Contact', profile?.emergencyContact || 'Not set'],
      ['Occupation', profile?.occupation],
    ];

    section.innerHTML = `
      <div class="profile-grid">
        <article class="profile-card profile-hero">
          <div class="profile-hero-top">
            <div class="profile-avatar">
              ${profile?.profilePhoto ? `<img src="${profile.profilePhoto}" alt="${HF.escape(profile.fullName)}"/>` : `<span>${HF.escape((profile?.fullName || current.username || 'U').slice(0, 1).toUpperCase())}</span>`}
            </div>
            <div class="profile-hero-copy">
              <div class="profile-name">${HF.escape(profile?.fullName || current.name)}</div>
              <div class="profile-meta-line">${HF.escape(current.username)} · ${HF.renderRolePill(current.role)}</div>
              <div class="profile-meta-line">${HF.renderStatusPill(profile?.verified ? 'approved' : 'pending')} ${HF.renderStatusPill(current.status || 'active')}</div>
            </div>
          </div>
          <p class="profile-about">${HF.escape(profile?.aboutMe || 'Add your profile notes to complete your identity record.')}</p>
        </article>

        <article class="profile-card">
          <div class="profile-card-title">Profile Details</div>
          <div class="profile-details-list">
            ${rows.map(([label, value]) => `
              <div class="profile-detail-row">
                <span>${HF.escape(label)}</span>
                <strong>${HF.escape(value || '-')}</strong>
              </div>`).join('')}
          </div>
        </article>

        <article class="profile-card">
          <div class="profile-card-title">Approval History</div>
          <div class="profile-requests">
            ${requests.length ? requests.map(request => `
              <div class="profile-request-row">
                <div>
                  <div class="profile-request-title">${HF.escape(request.title)}</div>
                  <div class="profile-request-meta">${HF.nowLabel(request.createdAt)}</div>
                </div>
                ${HF.renderRequestStatus(request.status)}
              </div>`).join('') : '<div class="empty-msg" style="padding:0">No requests for this profile yet.</div>'}
          </div>
        </article>
      </div>`;
  };

  HF.openProfileModal = function(){
    const current = HF.getCurrentUser();
    if(!current) return;
    const profile = HF.getProfile(current.id);
    if(!profile) return;
    $('pf-title').textContent = 'Profile Editor';
    $('pf-name').value = profile.fullName || '';
    $('pf-username').value = current.username || profile.username || '';
    $('pf-mobile').value = profile.mobileNumber || '';
    $('pf-email').value = profile.email || '';
    $('pf-password').value = '';
    $('pf-address').value = profile.address || '';
    $('pf-birth').value = profile.birthDate || '';
    $('pf-gender').value = profile.gender || '';
    $('pf-emergency').value = profile.emergencyContact || '';
    $('pf-occupation').value = profile.occupation || '';
    $('pf-about').value = profile.aboutMe || '';

    const direct = HF.isAdmin() || profile.allowDirectEdit || !HF.isProfileComplete(profile);
    $('pf-help').textContent = direct
      ? 'This profile can be saved directly.'
      : 'Sensitive profile changes are routed to admins for approval.';
    $('pf-save').textContent = direct ? 'Save Profile' : 'Submit Update Request';
    openM('profile-modal');
    setTimeout(() => $('pf-name').focus(), 40);
  };

  HF.collectProfileModalData = async function(){
    const profile = HF.getProfile(HF.getCurrentUser().id);
    const nextPhoto = $('pf-photo').files[0] ? await HF.readFileAsDataUrl($('pf-photo').files[0]) : profile.profilePhoto;
    return {
      fullName: $('pf-name').value.trim(),
      username: $('pf-username').value.trim(),
      mobileNumber: $('pf-mobile').value.trim(),
      email: $('pf-email').value.trim(),
      password: $('pf-password').value.trim(),
      profilePhoto: nextPhoto,
      address: $('pf-address').value.trim(),
      birthDate: $('pf-birth').value,
      gender: $('pf-gender').value,
      emergencyContact: $('pf-emergency').value.trim(),
      occupation: $('pf-occupation').value.trim(),
      aboutMe: $('pf-about').value.trim(),
    };
  };

  HF.saveProfile = async function(){
    const current = HF.getCurrentUser();
    const profile = HF.getProfile(current.id);
    const payload = await HF.collectProfileModalData();
    const { password, ...profileData } = payload;
    const error = HF.validateProfilePayload(payload, false);
    if(error){
      toast(error);
      return;
    }
    if(HF.usernameExists(payload.username, current.id)){
      toast('That username is already in use.');
      return;
    }
    if(HF.profileFieldExists('email', payload.email, current.id)){
      toast('That email is already in use.');
      return;
    }
    if(HF.profileFieldExists('mobileNumber', payload.mobileNumber, current.id)){
      toast('That mobile number is already in use.');
      return;
    }

    const direct = HF.isAdmin() || profile.allowDirectEdit || !HF.isProfileComplete(profile);
    if(direct){
      HF.getDB().profiles[current.id] = {
        ...profile,
        ...profileData,
        allowDirectEdit: false,
        updatedAt: Date.now(),
      };
      current.name = profileData.fullName;
      current.username = profileData.username;
      if(password) current.password = password;
      HF.logAction && HF.logAction('Profile updated', 'Profile details saved directly.', {
        targetUserId: current.id,
        userName: profileData.fullName,
        role: current.role,
      });
      HF.saveState();
      closeM('profile-modal');
      core.getFns().renderSidebarUser();
      HF.renderProfileSection();
      toast('Profile saved.');
      return;
    }

    HF.openRequestModal({
      type: 'profile_update',
        title: 'Request Profile Update',
        summary: 'Profile details need admin approval before they are changed.',
        context: 'Your current profile stays active until an admin approves the update.',
        targetUserId: current.id,
        payload: {
          profile: profileData,
          password,
        },
      });
    closeM('profile-modal');
  };

  HF.requestProfileDelete = function(){
    const current = HF.getCurrentUser();
    if(!current) return;
    HF.openRequestModal({
      type: 'profile_delete',
      title: 'Request Profile Deletion',
      summary: 'Delete this profile and all linked records.',
      context: 'This action is destructive and requires admin approval.',
      targetUserId: current.id,
      payload: {
        userId: current.id,
      },
    });
  };

  HF.injectProfileUI();

  const baseInitAuth = core.getFns().initAuth;
  const baseBindEvents = core.getFns().bindEvents;

  core.override({
    initAuth: function(){
      const loginError = $('login-err');
      const regError = $('reg-err');

      $('btn-login').addEventListener('click', () => {
        const identity = $('login-user').value.trim();
        const password = $('login-pass').value.trim();
        const found = HF.findCredentialUser(identity, password);
        if(!found){
          loginError.textContent = 'Invalid username, email, mobile number, or password.';
          loginError.classList.remove('hidden');
          return;
        }
        loginError.classList.add('hidden');
        core.getFns().loginUser(found);
      });

      $('login-pass').addEventListener('keydown', event => {
        if(event.key === 'Enter') $('btn-login').click();
      });

      $('btn-register').addEventListener('click', async () => {
        const payload = await HF.collectRegistrationData();
        const error = HF.validateProfilePayload(payload, true);
        if(error){
          regError.textContent = error;
          regError.classList.remove('hidden');
          return;
        }
        if(HF.usernameExists(payload.username)){
          regError.textContent = 'That username is already in use.';
          regError.classList.remove('hidden');
          return;
        }
        if(HF.profileFieldExists('email', payload.email)){
          regError.textContent = 'That email is already in use.';
          regError.classList.remove('hidden');
          return;
        }
        if(HF.profileFieldExists('mobileNumber', payload.mobileNumber)){
          regError.textContent = 'That mobile number is already in use.';
          regError.classList.remove('hidden');
          return;
        }
        if(HF.pendingAdminExists(payload)){
          regError.textContent = 'A pending admin request already exists for that username or email.';
          regError.classList.remove('hidden');
          return;
        }

        regError.classList.add('hidden');

        if(payload.roleChoice === 'admin'){
          HF.requestAdminRegistration(payload);
          toast('Admin request submitted for approval.');
          document.querySelector('[data-tab="login"]')?.click();
          return;
        }

        const user = HF.createDirectUser(payload);
        core.getFns().loginUser(user);
      });

      document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.auth-tab').forEach(node => node.classList.remove('active'));
          document.querySelectorAll('.auth-form-wrap').forEach(node => node.classList.remove('active'));
          tab.classList.add('active');
          const target = document.getElementById(`tab-${tab.dataset.tab}`);
          if(target) target.classList.add('active');
        });
      });

      $('btn-logout').addEventListener('click', core.getFns().logout);
    },
    bindEvents: function(){
      baseBindEvents();

      $('btn-edit-profile')?.addEventListener('click', HF.openProfileModal);
      $('btn-delete-profile')?.addEventListener('click', HF.requestProfileDelete);
      $('pf-x')?.addEventListener('click', () => closeM('profile-modal'));
      $('pf-cancel')?.addEventListener('click', () => closeM('profile-modal'));
      $('pf-save')?.addEventListener('click', HF.saveProfile);
    },
  });
})();
