/**
 * HabitFlow Pro v3 — medicineTracker.js
 * Medicine Reminder & Tracker Module
 * Advanced Tracking with Stock, Multiple Times, Dashboard
 */
(function(){
'use strict';

const $ = id => document.getElementById(id);
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function uid(){ return 'm_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7); }
function getToday(){ return new Date().toISOString().slice(0,10); }
function toast(msg,type='info'){ if(window.HFCore&&window.HFCore.toast) window.HFCore.toast(msg,type); else if(window.toast) window.toast(msg); }
function log(...a){ console.log('[MedicineTracker]',...a); }
function save(){ if(window.HFCore&&window.HFCore.save) window.HFCore.save(); else if(window.save) window.save(); }
function getDB(){ return window.HFCore&&window.HFCore.getDB?window.HFCore.getDB():{}; }
function getCU(){ return window.HFCore&&window.HFCore.getCurrentUser?window.HFCore.getCurrentUser():null; }
function uid_user(){ const u=getCU(); return u?u.id:''; }

// ─── DB accessors ─────────────────────────────────────────────────────────
function getMT(){
  const db=getDB(); const u=uid_user();
  let raw = (db.medicineTracker&&db.medicineTracker[u]) || {medicines:[], logs:[]};
  if(!raw || typeof raw!=='object') raw = {medicines:[], logs:[]};
  if(!Array.isArray(raw.medicines)) raw.medicines = [];
  if(!Array.isArray(raw.logs)) raw.logs = [];
  
  // Migration for old data
  raw.medicines.forEach(m => {
    if(!m.reminders) {
      m.reminders = [];
      if(m.morning) m.reminders.push({id:uid(), time:'08:00', label:'Morning'});
      if(m.noon) m.reminders.push({id:uid(), time:'14:00', label:'Noon'});
      if(m.night) m.reminders.push({id:uid(), time:'21:00', label:'Night'});
      if(!m.reminders.length) m.reminders.push({id:uid(), time:'08:00', label:'Morning'});
    }
    if(!m.type) m.type = 'tablet';
  });
  
  return raw;
}
function setMT(v){ const db=getDB(); const cu=getCU(); if(!cu) return; db.medicineTracker = db.medicineTracker || {}; db.medicineTracker[cu.id] = v; }

const FREQ_LABELS={daily:'Daily', alternate:'Alternate day', weekly:'Once a week', '2week':'2 times a week', '10days':'1 in 10 days', '15days':'1 in 15 days', monthly:'1 in month overall', custom:'Custom'};
const TYPE_ICONS={tablet:'💊', capsule:'💊', syrup:'🧪', injection:'💉', drops:'💧', topical:'🧴', ointment:'🩹', supplement:'⚡'};
const TYPE_COLORS={tablet:'#10B981', capsule:'#10B981', syrup:'#4F8EF7', injection:'#EF4444', drops:'#06B6D4', topical:'#8B5CF6', ointment:'#F59E0B', supplement:'#EC4899'};

// ─── Helpers ──────────────────────────────────────────────────────────────
function getReminders(m){
  return (m.reminders||[]).sort((a,b)=>a.time.localeCompare(b.time));
}

function isTakenToday(mt,mid,rId,date=getToday()){
  return mt.logs.some(l=>l.medicineId===mid && l.date===date && l.reminderId===rId && l.status==='taken');
}
function isSkippedToday(mt,mid,rId,date=getToday()){
  return mt.logs.some(l=>l.medicineId===mid && l.date===date && l.reminderId===rId && l.status==='skipped');
}

// Check if a medicine should be taken on a specific date based on frequency
function isMedActiveOnDate(m, dateStr) {
  if (m.startDate && dateStr < m.startDate) return false;
  if (m.endDate && dateStr > m.endDate) return false;
  
  if (!m.startDate) return true; // fallback
  
  const start = new Date(m.startDate);
  const target = new Date(dateStr);
  const diffTime = Math.abs(target - start);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (m.frequency === 'daily') return true;
  if (m.frequency === 'alternate') return diffDays % 2 === 0;
  if (m.frequency === 'weekly') return diffDays % 7 === 0;
  if (m.frequency === 'custom' && m.customDays) return diffDays % parseInt(m.customDays) === 0;
  if (m.frequency === 'monthly') return start.getDate() === target.getDate();
  
  return true;
}

// ─── Monthly tracker helpers ───────────────────────────────────────────────
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_S=['S','M','T','W','T','F','S'];
let _medMonth=new Date().getMonth(), _medYear=new Date().getFullYear(), _medFreqFilter='';
function dIM(m,y){ return new Date(y,m+1,0).getDate(); }
function isToday_(y,m,d){ const t=new Date(); return y===t.getFullYear()&&m===t.getMonth()&&d===t.getDate(); }
function isPast_(y,m,d){ const t=new Date(), c=new Date(y,m,d); return c<t && !isToday_(y,m,d); }
function isFuture_(y,m,d){ const t=new Date(), c=new Date(y,m,d); return c>t; }
function fmtDate(y,m,d){ return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

function getMedStatusOnDate(mt,m,dateStr){
  if(!isMedActiveOnDate(m, dateStr)) return 'none';
  const rems=getReminders(m);
  if(!rems.length) return 'none';
  const logs=mt.logs.filter(l=>l.medicineId===m.id && l.date===dateStr);
  if(!logs.length) return 'pending';
  const takenCount=logs.filter(l=>l.status==='taken').length;
  const skippedCount=logs.filter(l=>l.status==='skipped').length;
  
  if(takenCount === rems.length) return 'taken';
  if(skippedCount > 0 && takenCount === 0) return 'skipped';
  if(takenCount > 0) return 'partial';
  return 'pending';
}

function logMedOnDate(mid,rId,dateStr,status){
  const mt=getMT(); const m=mt.medicines.find(x=>x.id===mid); if(!m) return;
  const now=new Date();
  const timeStr=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  
  // Remove existing log for this specific reminder+date
  mt.logs=mt.logs.filter(l=>!(l.medicineId===mid && l.date===dateStr && l.reminderId===rId));
  
  mt.logs.push({id:uid(), medicineId:mid, reminderId:rId, date:dateStr, time:timeStr, status});
  
  // Update stock
  if(status === 'taken' && m.stock > 0) {
    m.stock--;
    if(m.lowStockAlert && m.stock <= m.lowStockAlert) {
      toast(`⚠️ Low stock for ${m.name}: ${m.stock} remaining`, 'warn');
    }
  }

  setMT(mt); save(); renderMedicineTracker();
  toast(status==='taken'?'✅ Medicine marked taken':'❌ Medicine marked skipped', status==='taken'?'ok':'warn');
  if(window.HF&&window.HF.Timeline&&window.HF.Timeline.renderTimelineSection) window.HF.Timeline.renderTimelineSection();
}

// ─── Render ─────────────────────────────────────────────────────────────────
function renderMedicineTracker(){
  try {
    const el=$('medicine-tracker'); if(!el) return;
    const mt=getMT(); const today=getToday();
    const todayLogs=mt.logs.filter(l=>l.date===today);
    const activeMeds=mt.medicines.filter(m=>!m.endDate||m.endDate>=today);
    const todayMeds=activeMeds.filter(m=>isMedActiveOnDate(m, today));

  let dashHtml = `<div class="med-dash-section">
    <div class="med-dash-title">📅 Today's Schedule</div>
    <div class="med-dash-grid">`;
  
  if(todayMeds.length===0){
    dashHtml += `<div class="empty-state compact" style="grid-column:1/-1; padding:20px;">🎉 No medicines scheduled for today!</div>`;
  } else {
    // Generate cards for each reminder of today's meds
    const allTodayReminders = [];
    todayMeds.forEach(m => {
      getReminders(m).forEach(r => {
        allTodayReminders.push({ med: m, reminder: r });
      });
    });
    
    // Sort by time
    allTodayReminders.sort((a,b) => a.reminder.time.localeCompare(b.reminder.time));
    
    allTodayReminders.forEach(item => {
      const {med, reminder} = item;
      const isTaken = isTakenToday(mt, med.id, reminder.id);
      const isSkipped = isSkippedToday(mt, med.id, reminder.id);
      let statusCls = 'upcoming', statusLbl = 'Upcoming';
      if(isTaken) { statusCls = 'taken'; statusLbl = 'Taken'; }
      else if(isSkipped) { statusCls = 'missed'; statusLbl = 'Skipped'; }

      const icon = TYPE_ICONS[med.type] || '💊';
      let timeFmt = reminder.time;
      try {
        const d = new Date(`2000-01-01T${reminder.time||'00:00'}`);
        if(!isNaN(d)) timeFmt = d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      } catch(e) {}
      const stockBadge = med.stock !== undefined && med.stock !== '' ? `<div class="med-stock ${med.stock <= (med.lowStockAlert||0) ? 'low' : ''}">📦 ${med.stock} left</div>` : '';
      
      dashHtml += `
      <div class="med-card">
        <div class="med-card-header">
          <div class="med-card-info">
            <div class="med-type-icon">${icon}</div>
            <div class="med-details">
              <h4>${esc(med.name)}</h4>
              <p>${esc(med.dosage)} • ${!med.mealTiming||med.mealTiming==='none'?'Anytime':med.mealTiming}</p>
            </div>
          </div>
          <div class="med-status-badge ${statusCls}">${statusLbl}</div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="med-time-badge">⏰ ${timeFmt} - ${reminder.label}</div>
          ${stockBadge}
        </div>
        <div class="med-card-actions">
          ${isTaken || isSkipped ? `<button class="med-btn" disabled style="opacity:.5">Done</button>` : 
          `<button class="med-btn med-btn-take" data-wt-action="take" data-mid="${med.id}" data-rid="${reminder.id}">✅ Take</button>
           <button class="med-btn med-btn-skip" data-wt-action="skip" data-mid="${med.id}" data-rid="${reminder.id}">❌ Skip</button>`
          }
        </div>
      </div>`;
    });
  }
  dashHtml += `</div></div>`;

  // Analysis
  let analysisHtml='';
  if(mt.medicines.length){
    const totalLogs=mt.logs.length;
    const takenLogs=mt.logs.filter(l=>l.status==='taken').length;
    const adherence=totalLogs?Math.round((takenLogs/totalLogs)*100):0;
    
    // Weekly consistency
    let weeklyTaken=0, weeklyTotal=0;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
    const weekAgoStr = weekAgo.toISOString().slice(0,10);
    mt.logs.forEach(l => {
      if(l.date >= weekAgoStr) {
        weeklyTotal++;
        if(l.status==='taken') weeklyTaken++;
      }
    });
    const weekAdh = weeklyTotal ? Math.round((weeklyTaken/weeklyTotal)*100) : 0;

    analysisHtml = `<div class="med-dash-section"><h4 class="med-sec-title">📊 Adherence Analytics</h4>
      <div class="med-stats-row">
        <div class="mstat"><div class="mstat-num">${adherence}%</div><div class="mstat-label">All-Time Adherence</div></div>
        <div class="mstat"><div class="mstat-num">${weekAdh}%</div><div class="mstat-label">7-Day Consistency</div></div>
        <div class="mstat"><div class="mstat-num">${mt.logs.filter(l=>l.status==='skipped').length}</div><div class="mstat-label">Total Missed</div></div>
      </div>
    </div>`;
  }

  el.innerHTML=`
    <div class="med-wrap">
      <div class="med-hero">
        <div class="med-hero-left">
          <div class="med-greeting">Stay Healthy!</div>
          <div class="med-subtitle">Track your medication and never miss a dose.</div>
          <div class="med-info-grid">
            <div class="med-info-card">
              <div class="med-info-ico">💊</div>
              <div class="med-info-val">${activeMeds.length}</div>
              <div class="med-info-lbl">Active Meds</div>
            </div>
            <div class="med-info-card">
              <div class="med-info-ico">✅</div>
              <div class="med-info-val">${todayLogs.filter(l=>l.status==='taken').length}</div>
              <div class="med-info-lbl">Taken Today</div>
            </div>
          </div>
        </div>
      </div>
      
      ${dashHtml}
      ${analysisHtml}
      ${renderMedMonthTable(mt)}
      
      <div class="med-dash-section">
        <h4 class="med-sec-title">💊 All Medicines</h4>
        <div class="med-list">
          ${mt.medicines.length?mt.medicines.map(m=>{
            const rems=getReminders(m).map(r=>`<span class="slot-chip">⏰ ${r.time}</span>`).join('');
            const active=(!m.endDate||m.endDate>=today);
            const mealChip=m.mealTiming&&m.mealTiming!=='none'?`<span class="meal-chip">🍽️ ${m.mealTiming}</span>`:'';
            const freqChip=`<span class="freq-chip">${m.frequency==='custom'?`Every ${m.customDays} days`:FREQ_LABELS[m.frequency]}</span>`;
            const dateRange=m.startDate?`${m.startDate} → ${m.endDate||'ongoing'}`:'';
            return `<div class="med-item ${active?'active':'completed'}" data-mid="${m.id}">
              <div class="med-item-hd">
                <span class="med-item-emoji">${TYPE_ICONS[m.type]||'💊'}</span>
                <div class="med-item-info">
                  <div class="med-item-name">${esc(m.name)} <span class="med-dosage">${esc(m.dosage)||''}</span></div>
                  <div class="med-item-meta">${freqChip} ${rems} ${mealChip} ${dateRange?`<span style="color:var(--ts)">📅 ${dateRange}</span>`:''}</div>
                  ${m.stock !== undefined && m.stock !== '' ? `<div class="med-item-meta" style="margin-top:4px;"><span style="color:${m.stock<=(m.lowStockAlert||0)?'#DC2626':'var(--ts)'}">📦 Stock: ${m.stock}</span></div>`:''}
                </div>
                <div class="med-item-acts">
                  ${m.prescription ? `<button class="med-act-btn" data-wt-action="view-rx" data-mid="${m.id}" title="View Prescription" style="background:#E0E7FF; color:#4338CA; border:none;">📄</button>` : ''}
                  <button class="med-act-btn med-act-edit" data-wt-action="edit" data-mid="${m.id}" title="Edit">✏️</button>
                  <button class="med-act-btn del med-act-del" data-wt-action="del" data-mid="${m.id}" title="Delete">🗑️</button>
                </div>
              </div>
              ${m.notes?`<div class="med-item-notes">📝 ${esc(m.notes)}</div>`:''}
            </div>`;
          }).join(''):'<div class="empty-state compact" style="padding:var(--s5)"><div class="empty-state-icon" style="font-size:48px">💊</div><h4 style="margin-top:var(--s3)">No medicines yet</h4><p>Add your first medicine to start tracking</p></div>'}
        </div>
      </div>
    </div>`;
  // Bind month/year select listeners after render since they're dynamic
  setTimeout(bindMedSelectListeners, 0);
  } catch(e) { console.error('Render Medicine Error:', e); }
}

// ─── Monthly Calendar Table ─────────────────────────────────────────────────
function renderMedMonthTable(mt){
  if(!mt.medicines.length) return '';
  const m=_medMonth, y=_medYear;
  const days=dIM(m,y);
  const today=new Date();
  const curMonth=today.getMonth(), curYear=today.getFullYear();

  let picker=`<div class="med-tracker-bar">
    <button class="med-tracker-nav" data-dir="prev" title="Previous month">‹</button>
    <select id="med-mon-sel" class="form-select sm">`;
  MONTHS.forEach((nm,mi)=>{ picker+=`<option value="${mi}" ${mi===m?'selected':''}>${nm}</option>`; });
  picker+=`</select>
    <select id="med-yr-sel" class="form-select sm">`;
  for(let yi=curYear-2; yi<=curYear+2; yi++){ picker+=`<option value="${yi}" ${yi===y?'selected':''}>${yi}</option>`; }
  picker+=`</select>
    <select id="med-freq-sel" class="form-select sm">
      <option value="">All Frequencies</option>
      <option value="daily" ${_medFreqFilter==='daily'?'selected':''}>Daily</option>
      <option value="weekly" ${_medFreqFilter==='weekly'?'selected':''}>Once a week</option>
      <option value="2week" ${_medFreqFilter==='2week'?'selected':''}>2 times a week</option>
      <option value="10days" ${_medFreqFilter==='10days'?'selected':''}>1 in 10 days</option>
      <option value="15days" ${_medFreqFilter==='15days'?'selected':''}>1 in 15 days</option>
      <option value="monthly" ${_medFreqFilter==='monthly'?'selected':''}>1 in month overall</option>
      <option value="custom" ${_medFreqFilter==='custom'?'selected':''}>Custom</option>
    </select>
    <button class="med-tracker-nav" data-dir="next" title="Next month">›</button>
    <button class="med-tracker-nav" data-dir="today" title="Go to today">📍 Today</button>
  </div>`;

  let head=`<tr><th class="th-habit med-th-habit">Medicine</th>`;
  for(let d=1; d<=days; d++){
    const dow=new Date(y,m,d).getDay();
    const isSun=dow===0, isTod=isToday_(y,m,d);
    head+=`<th class="${isSun?'col-sun':''} ${isTod?'col-today':''}" style="min-width:38px"><span style="display:block;font-size:12px;font-weight:700">${d}</span><span style="font-size:9px;opacity:.65">${DAYS_S[dow]}</span></th>`;
  }
  head+=`<th style="min-width:36px;font-size:10px;color:var(--tm);padding:4px 6px">%</th></tr>`;

  let body='';
  mt.medicines.forEach(med=>{
    if(_medFreqFilter && med.frequency !== _medFreqFilter) return;
    const c=TYPE_COLORS[med.type]||'#10B981';
    let row=`<tr style="background:${c}15">
      <td class="td-habit med-td-habit">
        <div class="hc">
          <span class="hc-em" style="font-size:20px">${TYPE_ICONS[med.type]||'💊'}</span>
          <div class="hc-nw">
            <div class="hc-name" title="${esc(med.name)}">${esc(med.name)}</div>
          </div>
        </div>
      </td>`;
    let takenCount=0, activeDays=0;
    for(let d=1; d<=days; d++){
      const dateStr=fmtDate(y,m,d);
      const isTod=isToday_(y,m,d);
      const past=isPast_(y,m,d);
      const future=isFuture_(y,m,d);
      
      const isActive = isMedActiveOnDate(med, dateStr);
      if(!isActive){
        row+=`<td class="td-day"><div class="dc med-dc disabled" title="Not scheduled">—</div></td>`;
        continue;
      }
      activeDays++;
      const status=getMedStatusOnDate(mt,med,dateStr);
      let cls='dc med-dc', ico='';
      if(isTod) cls+=' today-ring';
      if(status==='taken'){ cls+=' done'; ico='✓'; takenCount++; }
      else if(status==='skipped'){ cls+=' missed'; ico='✗'; }
      else if(status==='partial'){ cls+=' pending'; ico='◐'; }
      else if(future) cls+=' future';
      else cls+=' pending';
      if(past&&!isTod) cls+=' locked';
      row+=`<td class="td-day"><div class="${cls}" title="${esc(med.name)} ${dateStr}: ${status}">${ico}</div></td>`;
    }
    const pct=activeDays>0?Math.round((takenCount/activeDays)*100):0;
    row+=`<td class="row-pct" style="color:${pct>=80?'#10B981':pct>=50?'#F59E0B':'#EF4444'}">${pct}%</td></tr>`;
    body+=row;
  });

  return `${picker}
  <div class="med-dash-section">
    <h4 class="med-sec-title">📅 Monthly Medicine Tracker — ${MONTHS[m]} ${y}</h4>
    <div class="tbl-wrap med-tbl-wrap">
      <table class="tbl med-month-tbl" role="grid" aria-label="Medicine monthly tracker">
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </div>`;
}

// ─── Event Delegation ───────────────────────────────────────────────────────
function onTrackerClick(e){
  const actBtn = e.target.closest('[data-wt-action]');
  if(actBtn) {
    const action = actBtn.dataset.wtAction;
    const mid = actBtn.dataset.mid;
    const rid = actBtn.dataset.rid;
    if(action === 'take') logMedOnDate(mid, rid, getToday(), 'taken');
    else if(action === 'skip') logMedOnDate(mid, rid, getToday(), 'skipped');
    else if(action === 'edit') editMed(mid);
    else if(action === 'del') deleteMed(mid);
    else if(action === 'view-rx') {
      const med = getMed(mid);
      if(med && med.prescription) openRxViewer(med.prescription);
    }
    return;
  }
  
  const nav=e.target.closest('.med-tracker-nav[data-dir]');
  if(nav){
    const dir=nav.dataset.dir;
    if(dir==='prev'){ _medMonth--; if(_medMonth<0){_medMonth=11; _medYear--;} }
    else if(dir==='next'){ _medMonth++; if(_medMonth>11){_medMonth=0; _medYear++;} }
    else if(dir==='today'){ const t=new Date(); _medMonth=t.getMonth(); _medYear=t.getFullYear(); }
    renderMedicineTracker();
    return;
  }
}

function onMedSelectChange(e){
  const monSel=$('med-mon-sel'); const yrSel=$('med-yr-sel'); const freqSel=$('med-freq-sel');
  if(monSel) _medMonth=parseInt(monSel.value);
  if(yrSel) _medYear=parseInt(yrSel.value);
  if(freqSel) _medFreqFilter=freqSel.value;
  renderMedicineTracker();
}
function bindTrackerDelegation(){
  const el=$('medicine-tracker');
  if(el){
    el.addEventListener('click',onTrackerClick);
    log('tracker delegation bound');
  }
}
function bindMedSelectListeners(){
  const monSel=$('med-mon-sel'); const yrSel=$('med-yr-sel'); const freqSel=$('med-freq-sel');
  if(monSel){ monSel.addEventListener('change',onMedSelectChange); }
  if(yrSel){ yrSel.addEventListener('change',onMedSelectChange); }
  if(freqSel){ freqSel.addEventListener('change',onMedSelectChange); }
}

// ─── Modal & CRUD ────────────────────────────────────────────────────────────
function getMed(id){ const mt=getMT(); return mt.medicines.find(m=>m.id===id); }

let _editMedId=null;
let _tempReminders=[];

function renderReminderTimes(){
  const c = $('mm-times-container');
  if(!c) return;
  c.innerHTML = _tempReminders.map(r => `
    <div class="time-slot-entry" data-rid="${r.id}">
      <input type="time" class="form-input ts-time" value="${r.time}" />
      <input type="text" class="form-input ts-label" value="${r.label}" placeholder="Label (e.g. Morning)" />
      <button type="button" class="btn-remove" title="Remove" data-remove-rid="${r.id}">✕</button>
    </div>
  `).join('');
}
function addTempReminder(time, label) {
  _tempReminders.push({ id:uid(), time, label });
  renderReminderTimes();
}
function removeTempReminder(id) {
  _tempReminders = _tempReminders.filter(r => r.id !== id);
  renderReminderTimes();
}
function syncTempReminders() {
  const c = $('mm-times-container');
  if(!c) return;
  const entries = Array.from(c.querySelectorAll('.time-slot-entry'));
  _tempReminders = entries.map(el => ({
    id: el.dataset.rid,
    time: el.querySelector('.ts-time').value,
    label: el.querySelector('.ts-label').value.trim()
  }));
}

let _tempPrescriptionBase64 = null;

function processPrescriptionFile(file) {
  return new Promise((resolve) => {
    if(!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800; // Compress image to max 800px width/height
        if(width > height && width > maxDim) {
          height *= maxDim / width; width = maxDim;
        } else if(height > maxDim) {
          width *= maxDim / height; height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // Use 0.6 quality for JPEG
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function openRxViewer(imgSrc) {
  const modal = $('rx-viewer-modal');
  const img = $('rx-viewer-img');
  if(modal && img) {
    img.src = imgSrc;
    openModal('rx-viewer-modal');
  }
}

function openMedModal(id=null){
  _editMedId=id;
  const m=id?getMed(id):null;
  if($('mm-id')) $('mm-id').value=id||'';
  $('mm-name').value=m?m.name:'';
  $('mm-dosage').value=m?m.dosage:'';
  
  // Set type
  const type = m?m.type:'tablet';
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  
  if($('mm-freq')) {
    $('mm-freq').value=m?m.frequency:'daily';
    $('mm-custom-freq-opts').style.display = m&&m.frequency==='custom' ? 'block' : 'none';
  }
  if($('mm-freq-custom-days')) $('mm-freq-custom-days').value=m?(m.customDays||3):3;
  
  if($('mm-meal')) $('mm-meal').value=m?m.mealTiming||'none':'none';
  
  $('mm-start').value=m?m.startDate:'';
  $('mm-end').value=m?m.endDate:'';
  
  $('mm-stock').value=m?m.stock:'';
  $('mm-low-stock').value=m?m.lowStockAlert:'';
  
  $('mm-notes').value=m?m.notes:'';
  
  // Prescription reset
  _tempPrescriptionBase64 = m?m.prescription:null;
  if($('mm-prescription')) $('mm-prescription').value = '';
  if($('mm-prescription-preview')) {
    if(_tempPrescriptionBase64) {
      $('mm-prescription-preview').style.display = 'block';
      $('mm-prescription-img').src = _tempPrescriptionBase64;
      if($('mm-clear-prescription')) $('mm-clear-prescription').style.display = 'block';
    } else {
      $('mm-prescription-preview').style.display = 'none';
      $('mm-prescription-img').src = '';
      if($('mm-clear-prescription')) $('mm-clear-prescription').style.display = 'none';
    }
  }

  _tempReminders = m ? JSON.parse(JSON.stringify(m.reminders||[])) : [];
  if(!m) addTempReminder('08:00', 'Morning');
  renderReminderTimes();
  
  $('mm-title').textContent=id?'Edit Medicine':'Add Medicine';
  openModal('med-modal');
}

function saveMed(){
  try{
    const cu=getCU(); if(!cu){ toast('Please log in first','warn'); return; }
    const nameEl=$('mm-name');
    const name=nameEl.value.trim();
    if(!name){ toast('Medicine name is required','warn'); nameEl.focus(); return; }
    
    syncTempReminders();
    if(!_tempReminders.length){ toast('Add at least one reminder time','warn'); return; }
    
    const dosage=($('mm-dosage')&&$('mm-dosage').value.trim())||'';
    const activeTypeBtn = document.querySelector('.type-btn.active');
    const type = activeTypeBtn ? activeTypeBtn.dataset.type : 'tablet';
    const frequency=($('mm-freq')&&$('mm-freq').value)||'daily';
    const customDays=($('mm-freq-custom-days')&&$('mm-freq-custom-days').value)||'3';
    const mealTiming=($('mm-meal')&&$('mm-meal').value)||'none';
    const startDate=($('mm-start')&&$('mm-start').value)||'';
    const endDate=($('mm-end')&&$('mm-end').value)||'';
    
    if(startDate && endDate && endDate < startDate) {
      toast('End date cannot be before start date', 'warn'); return;
    }
    
    const stock=($('mm-stock')&&$('mm-stock').value.trim());
    const lowStockAlert=($('mm-low-stock')&&$('mm-low-stock').value.trim());
    
    const notes=($('mm-notes')&&$('mm-notes').value.trim())||'';
    
    const mt=getMT();
    const data={
      name, dosage, type, frequency, customDays, mealTiming, startDate, endDate, notes,
      reminders: _tempReminders,
      prescription: _tempPrescriptionBase64,
      stock: stock === '' ? undefined : parseInt(stock),
      lowStockAlert: lowStockAlert === '' ? undefined : parseInt(lowStockAlert)
    };
    
    if(_editMedId){
      const i=mt.medicines.findIndex(x=>x.id===_editMedId);
      if(i>=0){ mt.medicines[i]={...mt.medicines[i],...data}; toast('Medicine updated'); }
    } else {
      mt.medicines.push({id:uid(),...data});
      toast('Medicine added');
    }
    setMT(mt); closeModal('med-modal'); save(); renderMedicineTracker();
    if(window.HF&&window.HF.Timeline&&window.HF.Timeline.renderTimelineSection) window.HF.Timeline.renderTimelineSection();
  }catch(err){ console.error('saveMed error:',err); toast('Failed to save medicine','error'); }
}

function editMed(id){ openMedModal(id); }
function deleteMed(id){
  const doDelete=()=>{ const mt=getMT(); mt.medicines=mt.medicines.filter(m=>m.id!==id); mt.logs=mt.logs.filter(l=>l.medicineId!==id); setMT(mt); save(); renderMedicineTracker(); toast('Medicine deleted'); };
  if(window.HFCore&&window.HFCore.helpers&&window.HFCore.helpers.confirm){
    window.HFCore.helpers.confirm('Delete Medicine','Delete this medicine and its logs?','🗑️',doDelete);
  } else {
    if(!confirm('Delete this medicine and its logs?')) return;
    doDelete();
  }
}

// ─── Upcoming Timeline items (medicine) ─────────────────────────────────────
function getMedicineTimelineItems(){
  const mt=getMT(); const today=getToday();
  return mt.medicines.filter(m=>!m.endDate||m.endDate>=today).flatMap(m=>{
    if(!isMedActiveOnDate(m, today)) return [];
    return getReminders(m).map(r=>({
      type:'medicine', title:m.name, date:today, time:r.time,
      icon:TYPE_ICONS[m.type]||'💊', color:'#10B981', dosage:m.dosage, sub:r.label+(!m.mealTiming||m.mealTiming==='none'?'':' • '+m.mealTiming)
    }));
  });
}

// ─── Export ─────────────────────────────────────────────────────────────────
window.HF = window.HF || {};
window.HF.MedicineTracker = {
  renderMedicineTracker, openMedModal, saveMed, editMed, deleteMed, removeTempReminder, openRxViewer,
  getMedicineTimelineItems
};

// Modal helpers shadow
function openModal(id){ const ov=$(id); if(!ov) return; ov.classList.add('open'); ov.setAttribute('aria-hidden','false'); }
function closeModal(id){ const ov=$(id); if(!ov) return; ov.classList.remove('open'); ov.setAttribute('aria-hidden','true'); }

// Bind events on boot
function bindMedEvents(){
  const addBtn=$('btn-add-medicine');
  const saveBtn=$('mm-save');
  const cancelBtn=$('mm-cancel');
  const xBtn=$('mm-x');
  if(addBtn) addBtn.addEventListener('click',()=>openMedModal());
  if(saveBtn) saveBtn.addEventListener('click',saveMed);
  if(cancelBtn) cancelBtn.addEventListener('click',()=>closeModal('med-modal'));
  if(xBtn) xBtn.addEventListener('click',()=>closeModal('med-modal'));
  
  if($('rx-viewer-x')) $('rx-viewer-x').addEventListener('click',()=>closeModal('rx-viewer-modal'));

  // Prescription Upload
  const rxInput = $('mm-prescription');
  if(rxInput) {
    rxInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if(file) {
        toast('Processing image...', 'info');
        const b64 = await processPrescriptionFile(file);
        _tempPrescriptionBase64 = b64;
        if($('mm-prescription-preview')) {
          $('mm-prescription-preview').style.display = 'block';
          $('mm-prescription-img').src = b64;
          if($('mm-clear-prescription')) $('mm-clear-prescription').style.display = 'block';
        }
      }
    });
  }
  
  const rxClearBtn = $('mm-clear-prescription');
  if(rxClearBtn) {
    rxClearBtn.addEventListener('click', () => {
      _tempPrescriptionBase64 = null;
      if(rxInput) rxInput.value = '';
      $('mm-prescription-preview').style.display = 'none';
      $('mm-prescription-img').src = '';
      rxClearBtn.style.display = 'none';
    });
  }

  // Frequency toggle
  const freqSel = $('mm-freq');
  if(freqSel) {
    freqSel.addEventListener('change', (e) => {
      $('mm-custom-freq-opts').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
  }
  
  // Type selector
  const typeSel = $('mm-type-selector');
  if(typeSel) {
    typeSel.addEventListener('click', (e) => {
      const btn = e.target.closest('.type-btn');
      if(!btn) return;
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }

  // Add Time buttons
  $('btn-add-time-morning')?.addEventListener('click', () => { syncTempReminders(); addTempReminder('08:00', 'Morning'); });
  $('btn-add-time-noon')?.addEventListener('click', () => { syncTempReminders(); addTempReminder('14:00', 'Noon'); });
  $('btn-add-time-night')?.addEventListener('click', () => { syncTempReminders(); addTempReminder('21:00', 'Night'); });
  $('btn-add-time-custom')?.addEventListener('click', () => { syncTempReminders(); addTempReminder('12:00', 'Custom'); });

  const timesContainer = $('mm-times-container');
  if(timesContainer) {
    timesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-remove');
      if(btn) {
        const rid = btn.dataset.removeRid;
        if(rid) {
          syncTempReminders();
          removeTempReminder(rid);
        }
      }
    });
  }

  bindTrackerDelegation();
}

function initMedBindings(){
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(bindMedEvents,100));
  } else {
    setTimeout(bindMedEvents,100);
  }
}
initMedBindings();
})();
