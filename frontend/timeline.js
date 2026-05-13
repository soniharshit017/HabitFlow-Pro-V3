/**
 * HabitFlow Pro v3 — timeline.js
 * Upcoming Timeline System: combines Goal tasks, Water reminders, and Medicine reminders.
 * Sorted by nearest upcoming time.
 */
(function(){
'use strict';

const $ = id => document.getElementById(id);
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function getToday(){ return new Date().toISOString().slice(0,10); }
function toast(msg,type='info'){ if(window.HFCore&&window.HFCore.toast) window.HFCore.toast(msg,type); else if(window.toast) window.toast(msg); }
function save(){ if(window.HFCore&&window.HFCore.save) window.HFCore.save(); else if(window.save) window.save(); }
function getDB(){ return window.HFCore&&window.HFCore.getDB?window.HFCore.getDB():{}; }
function getCU(){ return window.HFCore&&window.HFCore.getCurrentUser?window.HFCore.getCurrentUser():null; }
function uid_user(){ const u=getCU(); return u?u.id:''; }

// ─── Collect all upcoming items ───────────────────────────────────────────
function getAllUpcoming(){
  let items=[];

  // Goal tasks
  const goals=(window.HF&&window.HF.GoalManager&&window.HF.GoalManager._getGoals?window.HF.GoalManager._getGoals():[])||[];
  const uid_=uid_user();
  goals.forEach(g=>{
    if(g.status==='completed') return;
    if(g.deadline){ items.push({type:'goal', title:g.title, date:g.deadline, time:'23:59', icon:'🎯', color:'#3B82F6', sub:'Goal deadline'}); }
    const tasks=(window.HF&&window.HF.GoalManager&&window.HF.GoalManager._getGoalTasks?window.HF.GoalManager._getGoalTasks(g.id):[])||[];
    tasks.filter(t=>t.status!=='done').forEach(t=>{
      items.push({type:'task', title:t.title, date:t.startDate||getToday(), time:t.time||'09:00', icon:t.emoji||'✅', color:'#60A5FA', sub:'Goal: '+g.title});
    });
  });

  // Water reminders
  const wt=(window.HF&&window.HF.WaterTracker&&window.HF.WaterTracker.getWaterTimelineItems?window.HF.WaterTracker.getWaterTimelineItems():[])||[];
  items=items.concat(wt);

  // Medicine reminders
  const mt=(window.HF&&window.HF.MedicineTracker&&window.HF.MedicineTracker.getMedicineTimelineItems?window.HF.MedicineTracker.getMedicineTimelineItems():[])||[];
  log('medicine timeline items',mt.length);
  items=items.concat(mt);

  // Sort by date+time
  items.sort((a,b)=>{
    const da=(a.date||getToday())+'T'+(a.time||'00:00');
    const db_=(b.date||getToday())+'T'+(b.time||'00:00');
    return da.localeCompare(db_);
  });

  return items;
}

// ─── Render Timeline ──────────────────────────────────────────────────────
function renderTimeline(){
  // Keep original daily timeline rendering from script.js via HFCore override
  // This function is overridden by timeline.js to also render upcoming items
  const el=$('timeline-upcoming-list'); if(!el) return;
  const items=getAllUpcoming();
  const filter=$('tl-filter')?$('tl-filter').value:'';
  const filtered=filter?items.filter(i=>i.type===filter):items;

  if(!filtered.length){
    el.innerHTML='<div class="empty-state compact"><div class="empty-state-icon">📅</div><h4>No upcoming items</h4><p>Add goals, tasks, water reminders, or medicines to see them here.</p></div>';
    return;
  }

  el.innerHTML=filtered.map(item=>`
    <div class="tl-card ${item.type}" style="--tlc:${item.color||'var(--pri)'}" data-tlid="${item.id||''}">
      <div class="tl-dot" style="background:${item.color||'var(--pri)'}">${item.icon}</div>
      <div class="tl-body">
        <div class="tl-title">${esc(item.title)}</div>
        <div class="tl-meta">
          <span class="tl-time">${item.time||'—'}</span>
          <span class="tl-date">${item.date||'—'}</span>
          ${item.sub?`<span class="tl-sub">${esc(item.sub)}</span>`:''}
          ${item.dosage?`<span class="tl-dosage">${esc(item.dosage)}</span>`:''}
        </div>
      </div>
      <div class="tl-badge" style="background:${item.color||'var(--pri)'}22; color:${item.color||'var(--pri)'}">${item.type}</div>
    </div>`).join('');
}

function renderTimelineSection(){
  renderTimeline();
}

// ─── Export ─────────────────────────────────────────────────────────────────
window.HF = window.HF || {};
window.HF.Timeline = {
  getAllUpcoming, renderTimeline, renderTimelineSection
};

function log(...a){ console.log('[Timeline]',...a); }

// Event Bindings
function initTimelineBindings(){
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', ()=>{
      setTimeout(()=>{
        const flt=document.getElementById('tl-filter');
        if(flt) flt.addEventListener('change', ()=>renderTimelineSection());
      }, 100);
    });
  } else {
    setTimeout(()=>{
      const flt=document.getElementById('tl-filter');
      if(flt) flt.addEventListener('change', ()=>renderTimelineSection());
    }, 100);
  }
}
initTimelineBindings();

// NOTE: Does NOT override renderTimeline to preserve original daily habit timeline.
// Instead, renderTimelineSection() is called separately by script.js goTo() and initApp().
})();
