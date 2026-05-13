/**
 * HabitFlow Pro v3 — waterTracker.js
 * Smart Water Reminder & Tracker Module
 */
(function(){
'use strict';

const $=id=>document.getElementById(id);
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function uid(){return 'w_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
function getToday(){return new Date().toISOString().slice(0,10)}
function toast(msg){if(window.HFCore&&window.HFCore.toast)window.HFCore.toast(msg);else if(window.toast)window.toast(msg)}
function save(){if(window.HFCore&&window.HFCore.save)window.HFCore.save();else if(window.save)window.save()}
function getDB(){return window.HFCore&&window.HFCore.getDB?window.HFCore.getDB():{}}
function getCU(){return window.HFCore&&window.HFCore.getCurrentUser?window.HFCore.getCurrentUser():null}
function uid_user(){const u=getCU();return u?u.id:''}

// ─── DB ───
function getWT(){
  const db=getDB(),u=uid_user();
  if(!db.waterTracker)db.waterTracker={};
  if(!db.waterTracker[u])db.waterTracker[u]={glasses:[],reminders:[],dailyTargetML:2500,glassSize:250,reminderInterval:1,activeReminders:true};
  const wt=db.waterTracker[u];
  if(!Array.isArray(wt.glasses))wt.glasses=[];
  if(!Array.isArray(wt.reminders))wt.reminders=[];
  if(!wt.dailyTargetML)wt.dailyTargetML=2500;
  if(!wt.glassSize)wt.glassSize=250;
  if(!wt.reminderInterval)wt.reminderInterval=1;
  if(wt.activeReminders===undefined)wt.activeReminders=true;
  return wt;
}
function setWT(v){const db=getDB(),u=uid_user();if(!db.waterTracker)db.waterTracker={};db.waterTracker[u]=v;}

// ─── State ───
let histMonth=new Date().getMonth(),histYear=new Date().getFullYear();
let _reminderTimers=[];

// ─── Helpers ───
function todayGlasses(wt){return(wt.glasses||[]).filter(g=>g.date===getToday())}
function todayML(wt){return todayGlasses(wt).reduce((a,g)=>a+(g.ml||250),0)}
function targetGlasses(wt){return Math.ceil(wt.dailyTargetML/wt.glassSize)}
function getHydrationMsg(pct){
  if(pct>=100)return{e:'🎉',t:'Goal Achieved!',s:'You\'re fully hydrated! Amazing job! 💪'};
  if(pct>=75)return{e:'💧',t:'Almost There!',s:'Keep going, you\'re doing great!'};
  if(pct>=50)return{e:'🌊',t:'Halfway!',s:'Good progress, keep sipping!'};
  if(pct>=25)return{e:'🥤',t:'Getting Started',s:'Time for another glass!'};
  return{e:'🏜️',t:'Stay Hydrated!',s:'Your body needs water, drink up!'};
}
function getAwakeHours(){
  const h=new Date().getHours();
  const wake=7,sleep=23;
  const remaining=Math.max(0,sleep-Math.max(h,wake));
  return{wake,sleep,remaining,total:sleep-wake};
}
function getSuggestion(wt){
  const remaining=wt.dailyTargetML-todayML(wt);
  if(remaining<=0)return null;
  const hrs=getAwakeHours().remaining;
  if(hrs<=0)return null;
  const glassesLeft=Math.ceil(remaining/wt.glassSize);
  const interval=hrs/glassesLeft;
  return{remaining,glassesLeft,interval:Math.max(0.25,interval),hrs};
}
function fmtInterval(h){
  if(h>=1)return h===1?'Every hour':`Every ${h.toFixed(1).replace('.0','')} hrs`;
  return `Every ${Math.round(h*60)} min`;
}
function getMonthKey(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function getMonthData(wt,y,m){
  const days=new Date(y,m+1,0).getDate();
  const data=[];
  for(let d=1;d<=days;d++){
    const dk=getMonthKey(y,m,d);
    const dg=(wt.glasses||[]).filter(g=>g.date===dk);
    const ml=dg.reduce((a,g)=>a+(g.ml||250),0);
    data.push({day:d,date:dk,ml,glasses:dg.length,pct:wt.dailyTargetML>0?Math.round(ml/wt.dailyTargetML*100):0});
  }
  return data;
}
function getLevelClass(pct){
  if(pct>=100)return'wt-lv5';if(pct>=75)return'wt-lv4';if(pct>=50)return'wt-lv3';if(pct>=25)return'wt-lv2';if(pct>0)return'wt-lv1';return'wt-lv0';
}

// ─── Render ───
function renderWaterTracker(){
  const el=$('water-tracker');if(!el)return;
  const wt=getWT(),today=getToday();
  const tg=todayGlasses(wt),ml=todayML(wt);
  const target=wt.dailyTargetML,gs=wt.glassSize;
  const pct=Math.min(100,Math.round(ml/target*100));
  const tGlasses=targetGlasses(wt);
  const filledG=Math.min(tGlasses,Math.floor(ml/gs));
  const msg=getHydrationMsg(pct);
  const sug=getSuggestion(wt);
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build glasses visual
  let glassesHTML='';
  for(let i=0;i<tGlasses;i++){
    glassesHTML+=`<div class="wt-glass ${i<filledG?'filled':'empty'}" title="Glass ${i+1}"></div>`;
  }

  // Build calendar
  const mData=getMonthData(wt,histYear,histMonth);
  const firstDow=new Date(histYear,histMonth,1).getDay();
  let calHTML=DAYS.map(d=>`<div class="wt-cal-hd">${d}</div>`).join('');
  for(let i=0;i<firstDow;i++)calHTML+=`<div class="wt-cal-cell empty"></div>`;
  const todayStr=getToday();
  mData.forEach(d=>{
    const lvl=getLevelClass(d.pct);
    const isToday=d.date===todayStr?'today-cell':'';
    const ico=d.pct>=100?'✅':d.pct>=50?'💧':d.pct>0?'💦':'';
    calHTML+=`<div class="wt-cal-cell ${lvl} ${isToday}" title="${d.date}: ${d.ml}ml (${d.pct}%)"><span class="wt-cal-day">${d.day}</span>${ico?`<span class="wt-cal-ico">${ico}</span>`:''}</div>`;
  });

  // Monthly analytics
  const monthTotal=mData.reduce((a,d)=>a+d.ml,0);
  const daysWithData=mData.filter(d=>d.ml>0).length;
  const monthAvg=daysWithData>0?Math.round(monthTotal/daysWithData):0;
  const perfectDays=mData.filter(d=>d.pct>=100).length;
  const bestDay=mData.reduce((a,d)=>d.ml>a.ml?d:a,{ml:0});
  const streak=calcStreak(wt);

  // Week bars
  const last7=[];
  for(let i=6;i>=0;i--){
    const dt=new Date();dt.setDate(dt.getDate()-i);
    const dk=dt.toISOString().slice(0,10);
    const dayML=(wt.glasses||[]).filter(g=>g.date===dk).reduce((a,g)=>a+(g.ml||250),0);
    last7.push({day:DAYS[dt.getDay()],ml:dayML,pct:target>0?Math.min(100,Math.round(dayML/target*100)):0});
  }
  const maxBar=Math.max(...last7.map(d=>d.ml),target);
  let barsHTML=last7.map(d=>`<div class="wt-ana-bar-row"><span class="wt-ana-bar-lbl">${d.day}</span><div class="wt-ana-bar-wrap"><div class="wt-ana-bar" style="width:${maxBar>0?Math.round(d.ml/maxBar*100):0}%"></div></div><span class="wt-ana-bar-val">${d.ml}ml</span></div>`).join('');

  // Today's log
  let logHTML='';
  if(tg.length){
    logHTML=tg.slice().reverse().map(g=>`<div class="wt-log-item"><span class="wt-log-time">🕐 ${g.time||'—'}</span><span class="wt-log-amt">💧 ${g.ml||250}ml</span><span class="wt-log-note">${g.count>1?`(${g.count} glasses)`:''}</span><button class="wt-log-del" data-wt-del-log="${g.id}" title="Remove">✕</button></div>`).join('');
  } else {
    logHTML='<div class="empty-state compact"><div class="empty-state-icon">💧</div><p>No water logged today. Start drinking!</p></div>';
  }

  // Reminders
  let remHTML='';
  if((wt.reminders||[]).length){
    remHTML=(wt.reminders||[]).map(r=>`<div class="wt-rem-item"><span class="wt-rem-time">${r.time||'—'}</span>${r.interval?`<span class="wt-rem-interval">⏰ ${fmtInterval(r.interval)}</span>`:''}<span class="wt-rem-msg">${esc(r.message||'Drink water')}</span><button class="wt-rem-toggle ${r.active!==false?'on':''}" data-wt-rem-toggle="${r.id}"></button><button class="wt-rem-del" data-wt-rem-delete="${r.id}">🗑️</button></div>`).join('');
  } else {
    remHTML='<div class="empty-state compact"><div class="empty-state-icon">🔔</div><p>No reminders set. Add one below!</p></div>';
  }

  el.innerHTML=`<div class="wt-wrap">
    <!-- Hero -->
    <div class="wt-hero">
      <div class="wt-hero-left">
        <div class="wt-greeting">${msg.e} ${msg.t}</div>
        <div class="wt-subtitle">${msg.s}</div>
        <div class="wt-ring-area">
          <div class="wt-ring-wrap">
            <svg class="wt-ring-svg" viewBox="0 0 120 120"><circle class="wt-ring-track" cx="60" cy="60" r="50"/><circle class="wt-ring-prog" cx="60" cy="60" r="50" style="stroke-dashoffset:${314-(pct/100)*314}"/></svg>
            <div class="wt-ring-inner"><span class="wt-ring-val">${pct}%</span><span class="wt-ring-unit">${ml}/${target}ml</span></div>
          </div>
          <div class="wt-ring-info">
            <div class="wt-ring-stat"><span class="wt-ring-stat-val">${filledG}/${tGlasses}</span><span class="wt-ring-stat-lbl">Glasses (${gs}ml)</span></div>
            <div class="wt-ring-stat"><span class="wt-ring-stat-val">${target-ml>0?target-ml:0}ml</span><span class="wt-ring-stat-lbl">Remaining</span></div>
          </div>
        </div>
        <div class="wt-glasses-visual">${glassesHTML}</div>
      </div>
      <div class="wt-hero-right">
        <div class="wt-info-grid">
          <div class="wt-info-card"><div class="wt-info-ico">🔥</div><div class="wt-info-val">${streak}</div><div class="wt-info-lbl">Day Streak</div></div>
          <div class="wt-info-card"><div class="wt-info-ico">⭐</div><div class="wt-info-val">${perfectDays}</div><div class="wt-info-lbl">Perfect Days</div></div>
          <div class="wt-info-card"><div class="wt-info-ico">📊</div><div class="wt-info-val">${monthAvg}ml</div><div class="wt-info-lbl">Daily Avg</div></div>
        </div>
        ${sug?`<div class="wt-setup-suggestion"><div class="wt-suggest-title">💡 Smart Suggestion</div><div class="wt-suggest-grid">
          <div class="wt-suggest-item">🥤 <strong>${sug.glassesLeft}</strong> glasses left</div>
          <div class="wt-suggest-item">⏰ <strong>${fmtInterval(sug.interval)}</strong></div>
          <div class="wt-suggest-item">💧 <strong>${sug.remaining}ml</strong> to go</div>
          <div class="wt-suggest-item">🕐 <strong>${sug.hrs}h</strong> remaining</div>
        </div></div>`:'<div class="wt-setup-suggestion"><div class="wt-suggest-title">🎉 Daily Goal Complete!</div><p style="font-size:13px;color:var(--ts);margin-top:4px">Great job staying hydrated today! Keep it up tomorrow! 💪</p></div>'}
        <!-- Setup -->
        <div class="wt-setup">
          <div class="wt-setup-title">⚙️ Daily Target Setup</div>
          <div class="wt-setup-row">
            <div class="form-group"><label class="form-label">Daily Target (ml)</label><input type="number" id="wt-target-ml" class="form-input" value="${wt.dailyTargetML}" min="500" max="10000" step="100"/></div>
            <div class="form-group"><label class="form-label">Glass Size (ml)</label><select id="wt-glass-size" class="form-select"><option value="150" ${gs===150?'selected':''}>150ml (Small)</option><option value="200" ${gs===200?'selected':''}>200ml (Standard)</option><option value="250" ${gs===250?'selected':''}>250ml (Medium)</option><option value="300" ${gs===300?'selected':''}>300ml (Large)</option><option value="500" ${gs===500?'selected':''}>500ml (Bottle)</option></select></div>
            <div class="form-group"><button class="btn btn-primary btn-sm" data-wt-action="saveSetup">💾 Save</button></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Add Actions - separate card for reliable click handling -->
    <div class="wt-quick-actions">
      <button class="btn btn-primary" data-wt-action="add1">💧 +1 Glass (${gs}ml)</button>
      <button class="btn btn-primary" data-wt-action="add2">🥤 +2 Glasses (${gs*2}ml)</button>
      <button class="btn btn-ghost" data-wt-action="addCustom">✏️ Custom Amount</button>
      <button class="btn btn-ghost" data-wt-action="reset">🔄 Reset Today</button>
    </div>

    <!-- Today Log -->
    <div class="wt-log">
      <div class="wt-log-title">📋 Today's Water Log <span style="font-size:12px;color:var(--tm);font-weight:500">(${tg.length} entries, ${ml}ml total)</span></div>
      <div class="wt-log-list">${logHTML}</div>
    </div>

    <!-- Reminders -->
    <div class="wt-reminders">
      <div class="wt-rem-title">🔔 Smart Reminders</div>
      <div class="wt-rem-add">
        <div class="form-group"><label class="form-label">Time</label><input type="time" id="wtr-time" class="form-input"/></div>
        <div class="form-group"><label class="form-label">Interval</label><select id="wtr-interval" class="form-select">
          <option value="0">One-time</option><option value="0.5">Every 30 min</option><option value="1" selected>Every 1 hour</option><option value="1.5">Every 1.5 hrs</option><option value="2">Every 2 hrs</option><option value="2.5">Every 2.5 hrs</option></select></div>
        <div class="form-group"><label class="form-label">Message</label><input type="text" id="wtr-msg" class="form-input" placeholder="💧 Time to drink water!"/></div>
        <div class="form-group"><button class="btn btn-primary btn-sm" data-wt-action="addReminder">➕ Add</button></div>
      </div>
      <div class="wt-rem-list">${remHTML}</div>
    </div>

    <!-- Monthly History -->
    <div class="wt-history">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <div class="wt-history-title">📅 Monthly History</div>
        <div class="wt-history-nav">
          <button class="wt-history-nav-btn" data-wt-action="prevMonth">◀</button>
          <span class="wt-history-label">${MONTHS[histMonth]} ${histYear}</span>
          <button class="wt-history-nav-btn" data-wt-action="nextMonth">▶</button>
        </div>
      </div>
      <div class="wt-cal-grid">${calHTML}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--tm)">
        <span>🟦 0-24%</span><span>🟦 25-49%</span><span>🟦 50-74%</span><span>🟦 75-99%</span><span>✅ 100%+</span>
      </div>
    </div>

    <!-- Analytics -->
    <div class="wt-analytics">
      <div class="wt-ana-title">📊 Weekly Overview</div>
      <div class="wt-ana-grid">
        <div class="wt-ana-card"><div class="wt-ana-card-ico">📆</div><div class="wt-ana-card-val">${daysWithData}</div><div class="wt-ana-card-lbl">Active Days</div></div>
        <div class="wt-ana-card"><div class="wt-ana-card-ico">💧</div><div class="wt-ana-card-val">${(monthTotal/1000).toFixed(1)}L</div><div class="wt-ana-card-lbl">Month Total</div></div>
        <div class="wt-ana-card"><div class="wt-ana-card-ico">🏆</div><div class="wt-ana-card-val">${bestDay.ml}ml</div><div class="wt-ana-card-lbl">Best Day</div></div>
        <div class="wt-ana-card"><div class="wt-ana-card-ico">📈</div><div class="wt-ana-card-val">${monthAvg>0?Math.round(monthAvg/target*100):0}%</div><div class="wt-ana-card-lbl">Avg Achievement</div></div>
      </div>
      <div class="wt-ana-bars">${barsHTML}</div>
    </div>
  </div>`;

  startReminderTimers();
}

// ─── Actions ───
function addGlass(ml,count){
  const wt=getWT();const now=new Date();
  wt.glasses.push({id:uid(),date:getToday(),time:now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),ml,count:count||1});
  setWT(wt);save();renderWaterTracker();
  const pct=Math.min(100,Math.round(todayML(wt)/wt.dailyTargetML*100));
  if(pct>=100)toast('🎉 Water goal achieved! You\'re fully hydrated!');
  else toast(`💧 Added ${ml}ml of water`);
}
function addCustom(){
  const v=prompt('Enter water amount in ml (e.g. 350):','250');
  if(!v)return;const ml=parseInt(v);
  if(ml>0&&ml<=5000)addGlass(ml,Math.ceil(ml/getWT().glassSize));
  else toast('⚠️ Enter a valid amount (1-5000ml)');
}
function resetToday(){
  if(!confirm('Reset today\'s water log?'))return;
  const wt=getWT();wt.glasses=wt.glasses.filter(g=>g.date!==getToday());
  setWT(wt);save();renderWaterTracker();toast('🔄 Today\'s water log reset');
}
function deleteLog(id){
  const wt=getWT();wt.glasses=wt.glasses.filter(g=>g.id!==id);
  setWT(wt);save();renderWaterTracker();toast('Removed entry');
}
function saveSetup(){
  const wt=getWT();
  const target=parseInt($('wt-target-ml')?.value)||2500;
  const gs=parseInt($('wt-glass-size')?.value)||250;
  wt.dailyTargetML=Math.max(500,Math.min(10000,target));
  wt.glassSize=gs;
  setWT(wt);save();renderWaterTracker();toast('✅ Water target updated!');
}
function addReminder(){
  const time=$('wtr-time')?.value;
  const interval=parseFloat($('wtr-interval')?.value)||0;
  const msg=$('wtr-msg')?.value?.trim()||'💧 Time to drink water!';
  if(!time){toast('⚠️ Select a time');return;}
  const wt=getWT();
  wt.reminders.push({id:uid(),time,interval,message:msg,active:true,createdAt:Date.now()});
  setWT(wt);save();renderWaterTracker();toast('🔔 Reminder added!');
}
function toggleReminder(id){
  const wt=getWT();const r=wt.reminders.find(x=>x.id===id);
  if(r)r.active=!r.active;
  setWT(wt);save();renderWaterTracker();
}
function deleteReminder(id){
  const wt=getWT();wt.reminders=wt.reminders.filter(r=>r.id!==id);
  setWT(wt);save();renderWaterTracker();toast('Reminder removed');
}
function calcStreak(wt){
  let streak=0;
  for(let i=0;i<365;i++){
    const d=new Date();d.setDate(d.getDate()-i);
    const dk=d.toISOString().slice(0,10);
    const ml=(wt.glasses||[]).filter(g=>g.date===dk).reduce((a,g)=>a+(g.ml||250),0);
    if(ml>=wt.dailyTargetML)streak++;else if(i>0)break;else break;
  }
  return streak;
}

// ─── Reminder Timers ───
function startReminderTimers(){
  _reminderTimers.forEach(t=>clearTimeout(t));_reminderTimers=[];
  const wt=getWT();
  (wt.reminders||[]).filter(r=>r.active!==false).forEach(r=>{
    if(!r.time)return;
    const[h,m]=r.time.split(':').map(Number);
    const now=new Date(),target=new Date();
    target.setHours(h,m,0,0);
    if(target<=now&&r.interval>0){
      while(target<=now)target.setTime(target.getTime()+r.interval*3600000);
    }
    if(target>now){
      const delay=target-now;
      if(delay<86400000){
        _reminderTimers.push(setTimeout(()=>{
          toast(`🔔 ${r.message||'Time to drink water!'}`);
          if('Notification' in window&&Notification.permission==='granted'){
            new Notification('💧 Water Reminder',{body:r.message||'Time to drink water!',icon:'💧'});
          }
        },delay));
      }
    }
  });
}

// ─── Events ───
document.addEventListener('DOMContentLoaded',()=>{
  if('Notification' in window&&Notification.permission==='default'){
    setTimeout(()=>Notification.requestPermission(),5000);
  }
  setTimeout(()=>{
    const el=$('water-tracker');
    if(el)el.addEventListener('click',e=>{
      const ab=e.target.closest('[data-wt-action]');
      if(ab){
        const a=ab.dataset.wtAction;
        const wt=getWT();
        if(a==='add1')addGlass(wt.glassSize,1);
        else if(a==='add2')addGlass(wt.glassSize*2,2);
        else if(a==='addCustom')addCustom();
        else if(a==='reset')resetToday();
        else if(a==='saveSetup')saveSetup();
        else if(a==='addReminder')addReminder();
        else if(a==='prevMonth'){histMonth--;if(histMonth<0){histMonth=11;histYear--;}renderWaterTracker();}
        else if(a==='nextMonth'){histMonth++;if(histMonth>11){histMonth=0;histYear++;}renderWaterTracker();}
        return;
      }
      const rt=e.target.closest('[data-wt-rem-toggle]');
      if(rt){toggleReminder(rt.dataset.wtRemToggle);return;}
      const rd=e.target.closest('[data-wt-rem-delete]');
      if(rd){deleteReminder(rd.dataset.wtRemDelete);return;}
      const ld=e.target.closest('[data-wt-del-log]');
      if(ld){deleteLog(ld.dataset.wtDelLog);return;}
    });
    const sb=$('btn-water-settings');
    if(sb)sb.addEventListener('click',()=>{
      const el=$('wt-target-ml');if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
    });
  },300);
});

// ─── Timeline Items ───
function getWaterTimelineItems(){
  const wt=getWT(),today=getToday();
  return(wt.reminders||[]).filter(r=>r.active!==false).map(r=>({type:'water',title:r.message||'Drink water',date:today,time:r.time,icon:'💧',color:'#0EA5E9'}));
}

// ─── Export ───
window.HF=window.HF||{};
window.HF.WaterTracker={renderWaterTracker,addGlass,resetToday,addReminder,deleteReminder,getWaterTimelineItems};
})();
