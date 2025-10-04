// =============================
// Storage & Constants
// =============================
const STORAGE_KEY = "todo_tasks_v3"; // version bump for new fields
const SETTINGS_KEY = "todo_settings_v1";
const USER_KEY = "todo_user_v1";

// =============================
// Utilities
// =============================
function pad(n){return n.toString().padStart(2,"0");}
function formatDateTime(dateObj=new Date()){return `${pad(dateObj.getDate())}/${pad(dateObj.getMonth()+1)}/${dateObj.getFullYear()} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;}
function todayISO(){return new Date().toISOString().slice(0,10);} // yyyy-mm-dd
function isOverdue(task){ if(!task.dueDate || task.isDone) return false; return task.dueDate < todayISO(); }
function escapeHTML(str){return str.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));}
function download(name,content){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);} 

// =============================
// State
// =============================
let tasks=[];
let settings={ theme:"light", sort:"newest", filter:"all", search:"", tag:null };
let currentUser = null; // {name,email,avatar}
// History stacks
let undoStack = []; // entries {type,...}
let redoStack = [];
const MAX_HISTORY = 100;

try { const stored = localStorage.getItem(STORAGE_KEY); tasks = stored? JSON.parse(stored): []; } catch { tasks=[]; }
if(!Array.isArray(tasks)) tasks=[];
if(tasks.length===0){ tasks.push({ id:Date.now(), title:"Homework", createdAt:Date.now(), createdLabel:formatDateTime(), dueDate: todayISO(), isDone:false, tags:[], recurrence:"none", description:"Sample description", relations:[] }); }
try { const usr = localStorage.getItem(USER_KEY); if(usr) currentUser = JSON.parse(usr); } catch {}
try { const st = localStorage.getItem(SETTINGS_KEY); if(st) settings={...settings, ...JSON.parse(st)}; } catch {}

function saveTasks(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function saveUser(){ if(currentUser) localStorage.setItem(USER_KEY, JSON.stringify(currentUser)); }

// =============================
// CRUD
// =============================
function parseTags(str){ if(!str) return []; return Array.from(new Set(str.split(/[ ,]+/).map(t=>t.trim().toLowerCase()).filter(Boolean))).slice(0,8); }
function addTask(title,due,tagsStr,recurrence='none', description='', relationsStr=''){ const trimmed = (title||"").trim(); if(!trimmed) return false; const safeDue = due||""; const tags=parseTags(tagsStr); const rec = ['daily','weekly','monthly'].includes(recurrence)?recurrence:'none'; const relations = parseRelations(relationsStr); tasks.unshift({ id:Date.now(), title:trimmed, createdAt:Date.now(), createdLabel:formatDateTime(), dueDate: safeDue, isDone:false, tags, recurrence: rec, description: (description||'').trim(), relations }); saveTasks(); render(); return true; }
function parseRelations(str){ if(!str) return []; return Array.from(new Set(str.split(/[\s,]+/).map(x=>x.trim()).filter(x=>/^\d+$/.test(x)))).map(Number).slice(0,10); }
function addDays(dateStr,days){ const d=new Date(dateStr); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function addMonths(dateStr,months){ const d=new Date(dateStr); d.setMonth(d.getMonth()+months); return d.toISOString().slice(0,10); }
function generateNextDue(t){ if(!t.dueDate) return ""; switch(t.recurrence){ case 'daily': return addDays(t.dueDate,1); case 'weekly': return addDays(t.dueDate,7); case 'monthly': return addMonths(t.dueDate,1); default: return ""; } }
function toggleDone(id){ const t = tasks.find(t=>t.id===id); if(!t) return; const wasDone = t.isDone; t.isDone=!t.isDone; saveTasks(); renderSingle(id); updateStats();
  pushHistory({type:'toggle', id, before:{isDone:wasDone}, after:{isDone:t.isDone}});
  // If just marked done and recurring, create next instance
  if(!wasDone && t.isDone && t.recurrence && t.recurrence!=='none'){ const nextDue = generateNextDue(t); if(nextDue){ addTask(t.title, nextDue, (t.tags||[]).join(' '), t.recurrence); } }
}
function deleteTask(id){ const i=tasks.findIndex(t=>t.id===id); if(i===-1) return; const removed = tasks[i]; tasks.splice(i,1); saveTasks(); const el=document.querySelector(`.task[data-id="${id}"]`); if(el) el.remove(); updateStats(); pushHistory({type:'delete', task:removed, index:i}); }
function updateTask(id,data){ const t = tasks.find(t=>t.id===id); if(!t) return; const before={...t}; Object.assign(t,data); saveTasks(); renderSingle(id); pushHistory({type:'update', id, before, after:{...t}}); }

// Bulk
function clearCompleted(){ const removed = tasks.filter(t=>t.isDone); if(!removed.length) return; tasks = tasks.filter(t=>!t.isDone); saveTasks(); render(); pushHistory({type:'bulkDelete', tasks:removed}); }
function markAllDone(){ const changed = tasks.filter(t=>!t.isDone).map(t=>({id:t.id,before:{isDone:false}})); if(!changed.length) return; tasks.forEach(t=>t.isDone=true); saveTasks(); render(); pushHistory({type:'bulkToggle', items:changed}); }

// Sort & Filter & Search
function getViewTasks(){ let list=[...tasks]; // filter
 if(settings.filter==="open") list=list.filter(t=>!t.isDone);
 else if(settings.filter==="done") list=list.filter(t=>t.isDone);
 else if(settings.filter==="overdue") list=list.filter(t=>isOverdue(t));
 else if(settings.filter==="recurring") list=list.filter(t=>t.recurrence && t.recurrence!=='none');
 if(settings.tag) list=list.filter(t=>t.tags && t.tags.includes(settings.tag));
 // search
 if(settings.search){ const q=settings.search.toLowerCase(); list=list.filter(t=>t.title.toLowerCase().includes(q)); }
 // sort
 switch(settings.sort){
  case "oldest": list.sort((a,b)=>a.createdAt-b.createdAt); break;
  case "az": list.sort((a,b)=>a.title.localeCompare(b.title)); break;
  case "za": list.sort((a,b)=>b.title.localeCompare(a.title)); break;
  case "due_asc": list.sort((a,b)=>(a.dueDate||"zzz").localeCompare(b.dueDate||"zzz")); break;
  case "due_desc": list.sort((a,b)=>(b.dueDate||"").localeCompare(a.dueDate||"")); break;
  default: // newest
    list.sort((a,b)=>b.createdAt-a.createdAt);
 }
 return list;
}

// =============================
// DOM References
// =============================
const iconsContainer = document.getElementById('icons');
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const dueInput = document.getElementById('dueInput');
const tagsInput = document.getElementById('tagsInput');
const activeTagFilterEl = document.getElementById('activeTagFilter');
const filterStatus = document.getElementById('filterStatus');
const sortBy = document.getElementById('sortBy');
const searchBox = document.getElementById('search');
const statsBar = document.getElementById('statsBar');
const btnClearCompleted = document.getElementById('btnClearCompleted');
const btnMarkAll = document.getElementById('btnMarkAll');
const btnExport = document.getElementById('btnExport');
const importFile = document.getElementById('importFile');
const themeToggle = document.getElementById('themeToggle');
const addBtn = document.getElementById('add');
const notifyBtn = document.getElementById('notifyBtn');
const btnMap = document.getElementById('btnMap');
const mapModal = document.getElementById('mapModal');
const mapClose = document.getElementById('mapClose');
let graphInitialized=false;

// initialize form controls with settings
filterStatus.value = settings.filter;
sortBy.value = settings.sort;
searchBox.value = settings.search;
applyTheme(settings.theme);

// =============================
// Templates & Rendering
// =============================
function taskTemplate(t){
 const overdue = isOverdue(t);
 const dueToday = t.dueDate && t.dueDate===todayISO() && !t.isDone;
 const tagsHTML = (t.tags&&t.tags.length)?`<div class="tags">${t.tags.map(tag=>`<span class="tag light" data-tag="${escapeHTML(tag)}" title="Filter by tag">${escapeHTML(tag)}</span>`).join('')}</div>`:'';
 const recMap={daily:'D',weekly:'W',monthly:'M'}; const recBadge = t.recurrence&&t.recurrence!=='none'?`<span class="recurr-badge" title="${t.recurrence} task">${recMap[t.recurrence]||''}</span>`:'';
 const relationsHTML = (t.relations&&t.relations.length)?`<div class="relations">${t.relations.map(r=>`<span class="rel-chip" data-rel="${r}" title="Open related task">#${r}</span>`).join('')}</div>`:'';
 const descToggle = t.description?`<button class="desc-toggle" data-act="toggle-desc">Description</button>`:'';
 const descHTML = t.description?`<div class="desc collapsed" data-role="desc">${escapeHTML(t.description)}</div>`:'';
 return `<div class="task${t.isDone?" done":""}${overdue?" overdue":""}" data-id="${t.id}" draggable="true">
  <button class="drag-handle" title="Drag to reorder" aria-label="Reorder">☰</button>
  <div class="task-main">
    <h3 class="task-title" tabindex="0">${escapeHTML(t.title)} ${recBadge}</h3>
    <small class="task-date">Created: ${t.createdLabel}${t.dueDate?` | Due: ${t.dueDate}`:""}${dueToday?" | TODAY": ""}${overdue?" | OVERDUE":""}</small>
    ${tagsHTML}
    ${relationsHTML}
    ${descToggle}
    ${descHTML}
  </div>
  <div class="task-actions">
    <button class="btn-done" title="${t.isDone?"Mark as not done":"Mark as done"}"><i class='bxr bx-check-circle'></i></button>
    <button class="btn-edit" title="Edit"><i class='bxr bx-edit'></i></button>
    <button class="btn-delete" title="Delete"><i class='bxr bx-trash'></i></button>
  </div>
 </div>`;
}

function render(){ const list = getViewTasks(); iconsContainer.innerHTML = list.map(taskTemplate).join(''); updateStats(); }
function renderSingle(id){ const t = tasks.find(t=>t.id===id); if(!t) return render(); const node = document.querySelector(`.task[data-id="${id}"]`); if(!node) return render(); node.outerHTML = taskTemplate(t); }

// Stats
function updateStats(){ const total=tasks.length; const done=tasks.filter(t=>t.isDone).length; const overdue=tasks.filter(t=>isOverdue(t)).length; const percent= total? Math.round((done/total)*100):0; statsBar.innerHTML = `<div class="bar"><span style="width:${percent}%"></span></div><div class="numbers"><span>Total: ${total}</span><span>Done: ${done}</span><span>Overdue: ${overdue}</span><span>${percent}%</span></div>`; renderActiveTag(); }

function renderActiveTag(){ if(settings.tag){ activeTagFilterEl.classList.remove('hidden'); activeTagFilterEl.innerHTML = `<span>Filtering by tag: <strong>${escapeHTML(settings.tag)}</strong></span> <button type="button" class="clear-tag btn" id="clearTagFilter">Clear Tag</button>`; } else { activeTagFilterEl.classList.add('hidden'); activeTagFilterEl.innerHTML=''; } }

// =============================
// Theme
// =============================
function applyTheme(mode){ const root=document.documentElement; if(mode==="dark") root.classList.add('theme-dark'); else root.classList.remove('theme-dark'); themeToggle.textContent = mode==="dark"?"☀️":"🌙"; settings.theme=mode; saveSettings(); }

// =============================
// Events
// =============================
const relInput = document.getElementById('relInput');
const descInput = document.getElementById('descInput');
taskForm.addEventListener('submit',e=>{ e.preventDefault(); if(addTask(taskInput.value, dueInput.value, tagsInput.value, document.getElementById('recurrence').value, descInput.value, relInput.value)){ taskForm.reset(); taskInput.focus(); }});
filterStatus.addEventListener('change',()=>{ settings.filter=filterStatus.value; saveSettings(); render(); });
sortBy.addEventListener('change',()=>{ settings.sort=sortBy.value; saveSettings(); render(); });
searchBox.addEventListener('input',()=>{ settings.search=searchBox.value.trim(); saveSettings(); render(); });
btnClearCompleted.addEventListener('click',()=>{ if(confirm('Clear all completed tasks?')) clearCompleted(); });
btnMarkAll.addEventListener('click',()=>{ if(confirm('Mark all tasks as done?')) markAllDone(); });
const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
btnExport.addEventListener('click',()=>{ download('tasks-export.json', JSON.stringify({version:1, tasks}, null,2)); });
btnExport.title='Export all data (v3)';
// Improved export (v3 schema)
btnExport.addEventListener('contextmenu',e=>{ e.preventDefault(); exportDataV3(); });
function exportDataV3(){ const blob = { version:3, exportedAt:new Date().toISOString(), tasks, settings, user: currentUser? {name:currentUser.name,email:currentUser.email}:null }; download('tasks-export-v3.json', JSON.stringify(blob,null,2)); }
importFile.addEventListener('change', (e)=>{ const file = e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=evt=>{ try{ const data=JSON.parse(evt.target.result); if(!data.tasks || !Array.isArray(data.tasks)) throw new Error('Invalid file');
  const imported = data.tasks.filter(t=>t && typeof t.title==='string').map(t=>({ id: t.id||Date.now()+Math.random(), title: t.title.slice(0,200), createdAt: t.createdAt||Date.now(), createdLabel: t.createdLabel||formatDateTime(), dueDate: t.dueDate||"", isDone: !!t.isDone, tags: t.tags||[], recurrence: t.recurrence||'none', description: t.description||'', relations: Array.isArray(t.relations)? t.relations: [] }));
  tasks = imported.concat(tasks); saveTasks(); if(data.settings) { settings={...settings, ...data.settings}; applyTheme(settings.theme); } if(data.user){ currentUser={ name:data.user.name||'Imported', email:data.user.email||'', avatar:""}; saveUser(); updateUserUI(); } render(); alert('Imported '+imported.length+' tasks'); }catch(err){ alert('Import failed: '+err.message);} finally { importFile.value=''; } }; reader.readAsText(file); });
themeToggle.addEventListener('click',()=>{ applyTheme(settings.theme==="dark"?"light":"dark"); });
addBtn.addEventListener('click',()=>{ taskInput.focus(); });

// Notifications
function canNotify(){ return 'Notification' in window; }
function updateNotifyBtn(){ if(!canNotify()){ notifyBtn.disabled=true; notifyBtn.textContent='🚫'; return; } const perm=Notification.permission; if(perm==='granted'){ notifyBtn.classList.add('notify-active'); notifyBtn.textContent='🔕'; notifyBtn.title='Disable (via browser settings)'; } else { notifyBtn.classList.remove('notify-active'); notifyBtn.textContent='🔔'; notifyBtn.title='Enable notifications'; } }
notifyBtn.addEventListener('click',()=>{ if(!canNotify()) return alert('Notifications not supported'); if(Notification.permission==='granted'){ alert('To disable, change browser site settings.'); } else if(Notification.permission==='denied'){ alert('You blocked notifications. Enable from browser settings.'); } else { Notification.requestPermission().then(updateNotifyBtn).then(checkOverdueNotify); } });
function checkOverdueNotify(){ if(Notification.permission!=='granted') return; const overdue = tasks.filter(t=>isOverdue(t) && !t.isDone); if(overdue.length){ new Notification('Overdue Tasks', { body: `${overdue.length} task(s) need attention.` }); } }
updateNotifyBtn();
// Check after load
window.addEventListener('load', ()=> setTimeout(checkOverdueNotify, 1000));

// Inline Edit (delegated)
iconsContainer.addEventListener('click',e=>{
 const btn = e.target.closest('button'); if(!btn) return; const wrap = btn.closest('.task'); if(!wrap) return; const id = Number(wrap.dataset.id);
 if(btn.classList.contains('btn-done')) return toggleDone(id);
 if(btn.classList.contains('btn-delete')) { if(confirm('Delete this task?')) deleteTask(id); return; }
 if(btn.classList.contains('btn-edit')) { startInlineEdit(id, wrap); return; }
  if(btn.dataset.act==='toggle-desc'){ const desc = wrap.querySelector('[data-role="desc"]'); if(desc){ desc.classList.toggle('collapsed'); } }
 // tag click handled separately
});
// Relations click -> scroll to related
iconsContainer.addEventListener('click', e=>{ const rel = e.target.closest('.rel-chip'); if(!rel) return; const targetId = Number(rel.dataset.rel); const el = document.querySelector(`.task[data-id="${targetId}"]`); if(el){ el.classList.add('highlight'); el.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=>el.classList.remove('highlight'),1500); }
});

// =============================
// Auth & Welcome & Profile
// =============================
const welcomeOverlay = document.getElementById('welcomeOverlay');
const btnGetStarted = document.getElementById('btnGetStarted');
const authModal = document.getElementById('authModal');
const authClose = document.getElementById('authClose');
const authForm = document.getElementById('authForm');
const googleLoginBtn = document.getElementById('googleLogin');
const profileBtn = document.getElementById('profileBtn');
const profileMenu = document.getElementById('profileMenu');
const btnLogout = document.getElementById('btnLogout');
const avatarInitial = document.getElementById('avatarInitial');
const profName = document.getElementById('profName');
const profEmail = document.getElementById('profEmail');

function updateUserUI(){ if(currentUser){ avatarInitial.textContent = (currentUser.name||'U').charAt(0).toUpperCase(); profName.textContent=currentUser.name; profEmail.textContent=currentUser.email; } else { avatarInitial.textContent='U'; profName.textContent='Guest'; profEmail.textContent='Not signed in'; } }
updateUserUI();

if(currentUser){ welcomeOverlay.classList.remove('visible'); }

btnGetStarted?.addEventListener('click', ()=>{ welcomeOverlay.classList.remove('visible'); setTimeout(()=>{ authModal.classList.remove('hidden'); }, 300); });
authClose?.addEventListener('click', ()=> authModal.classList.add('hidden'));
authForm?.addEventListener('submit', e=>{ e.preventDefault(); const name=authForm.querySelector('#authName').value.trim(); const email=authForm.querySelector('#authEmail').value.trim(); const pass=authForm.querySelector('#authPass').value.trim(); if(!name||!email||!pass) return; currentUser={name,email, avatar:""}; saveUser(); updateUserUI(); authModal.classList.add('hidden'); document.body.classList.add('effect-shimmer'); setTimeout(()=>document.body.classList.remove('effect-shimmer'), 2500); startTour(); });
profileBtn?.addEventListener('click', ()=>{ profileMenu.classList.toggle('hidden'); const open=!profileMenu.classList.contains('hidden'); profileMenu.setAttribute('aria-hidden', open? 'false':'true'); });
document.addEventListener('click', e=>{ if(!e.target.closest('.profile-area')){ profileMenu.classList.add('hidden'); } });
btnLogout?.addEventListener('click', ()=>{ if(confirm('Logout?')){ currentUser=null; localStorage.removeItem(USER_KEY); updateUserUI(); welcomeOverlay.classList.add('visible'); }});
googleLoginBtn?.addEventListener('click', ()=>{ alert('Google Sign-In placeholder. Configure CLIENT_ID & script to enable.'); });

// =============================
// Tour (basic implementation)
// =============================
const tourLayer = document.getElementById('tourLayer');
let tourStep=0; const TOUR_KEY='todo_tour_done_v1';
function startTour(){ if(localStorage.getItem(TOUR_KEY)) return; tourStep=0; showTourStep(); }
function endTour(){ tourLayer.classList.add('hidden'); tourLayer.innerHTML=''; localStorage.setItem(TOUR_KEY,'1'); }
function nextTour(){ tourStep++; if(tourStep>=tourData.length){ endTour(); return; } showTourStep(); }
const tourData=[
 { sel:'#taskForm', title:'Add Tasks', body:'Use this form to create tasks with tags, due dates, recurrence and descriptions.' },
 { sel:'.filters-row', title:'Filters & Sort', body:'Filter by status, overdue, tags and sort tasks as you like.' },
 { sel:'#search', title:'Search', body:'Type to instantly filter tasks by title.' },
 { sel:'#statsBar', title:'Progress', body:'Track overall completion and overdue counts here.' },
 { sel:'#themeToggle', title:'Themes', body:'Switch between light and dark mode anytime.' },
 { sel:'#notifyBtn', title:'Reminders', body:'Enable notifications to get overdue alerts.' }
];
function showTourStep(){ const step = tourData[tourStep]; const el = document.querySelector(step.sel); if(!el){ nextTour(); return; } const rect = el.getBoundingClientRect(); tourLayer.classList.remove('hidden'); tourLayer.innerHTML = `<div class="spotlight" style="top:${rect.top+window.scrollY-6}px; left:${rect.left-6}px; width:${rect.width+12}px; height:${rect.height+12}px"></div><div class="tour-tip" style="top:${rect.bottom+window.scrollY+10}px; left:${rect.left}px"><h4>${escapeHTML(step.title)}</h4><p>${escapeHTML(step.body)}</p><div class="actions"><button class="btn" data-tour="next">${tourStep===tourData.length-1? 'Finish':'Next'}</button><button class="btn subtle" data-tour="skip">Skip</button></div></div>`; }
tourLayer.addEventListener('click', e=>{ const b = e.target.closest('button'); if(!b) return; if(b.dataset.tour==='next'){ nextTour(); } else if(b.dataset.tour==='skip'){ endTour(); } });

if(currentUser){ setTimeout(startTour, 800); }


// Tag click (event delegation)
iconsContainer.addEventListener('click',e=>{ const tagEl = e.target.closest('.tag'); if(!tagEl) return; const tag = tagEl.dataset.tag; settings.tag=tag; saveSettings(); render(); });

// Clear tag filter
activeTagFilterEl.addEventListener('click', e=>{ if(e.target.id==='clearTagFilter'){ settings.tag=null; saveSettings(); render(); }});

// Double click to edit
iconsContainer.addEventListener('dblclick',e=>{ const titleEl = e.target.closest('.task-title'); if(!titleEl) return; const taskEl = titleEl.closest('.task'); if(!taskEl) return; startInlineEdit(Number(taskEl.dataset.id), taskEl); });

// Keyboard: Enter to add quickly when input focused already handled by form; Esc cancels edit
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ cancelAnyEdit(); }});

// Drag & Drop
let dragId=null;
iconsContainer.addEventListener('dragstart',e=>{ const card = e.target.closest('.task'); if(!card) return; dragId = Number(card.dataset.id); card.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
iconsContainer.addEventListener('dragend',e=>{ const card = e.target.closest('.task'); if(card) card.classList.remove('dragging'); dragId=null; });
iconsContainer.addEventListener('dragover',e=>{ e.preventDefault(); const after = getDragAfterElement(e.clientY); if(after==null) iconsContainer.appendChild(document.querySelector('.dragging')); else iconsContainer.insertBefore(document.querySelector('.dragging'), after); });
iconsContainer.addEventListener('drop',()=>{ // update order according to DOM
 const before = tasks.map(t=>t.id);
 const ids=[...iconsContainer.querySelectorAll('.task')].map(n=>Number(n.dataset.id)); tasks.sort((a,b)=> ids.indexOf(a.id)-ids.indexOf(b.id)); saveTasks(); const after = tasks.map(t=>t.id); if(JSON.stringify(before)!==JSON.stringify(after)) pushHistory({type:'reorder', before, after}); });

function getDragAfterElement(y){ const els=[...iconsContainer.querySelectorAll('.task:not(.dragging)')]; return els.reduce((closest,child)=>{ const box=child.getBoundingClientRect(); const offset=y-box.top-box.height/2; if(offset<0 && offset>closest.offset) return {offset, element:child}; else return closest; }, {offset: Number.NEGATIVE_INFINITY}).element; }

// Inline edit helpers
let editingId=null;
function startInlineEdit(id, taskEl){ if(editingId!==null) cancelAnyEdit(); const t=tasks.find(t=>t.id===id); if(!t) return; editingId=id; const titleEl=taskEl.querySelector('.task-title'); const input=document.createElement('input'); input.type='text'; input.value=t.title; input.maxLength=200; input.className='edit-input'; input.style.padding='4px 6px'; input.style.fontSize='1rem'; titleEl.replaceWith(input); input.focus(); input.select(); const commit=()=>{ const val=input.value.trim(); if(val){ updateTask(id,{title:val}); } else { cancelAnyEdit(); } editingId=null; }; input.addEventListener('keydown',ev=>{ if(ev.key==='Enter') { commit(); } else if(ev.key==='Escape'){ cancelAnyEdit(); }}); input.addEventListener('blur',()=>{ if(editingId!==null) commit(); }); }
function cancelAnyEdit(){ if(editingId===null) return; const id=editingId; editingId=null; renderSingle(id); }

// Initial render
render();

// =============================
// History (Undo/Redo)
// =============================
function pushHistory(entry){ redoStack=[]; undoStack.push(entry); if(undoStack.length>MAX_HISTORY) undoStack.shift(); updateHistoryButtons(); }
function updateHistoryButtons(){ if(btnUndo) btnUndo.disabled = undoStack.length===0; if(btnRedo) btnRedo.disabled = redoStack.length===0; }
function undo(){ const e = undoStack.pop(); if(!e) return; applyInverse(e); redoStack.push(e); saveTasks(); render(); updateHistoryButtons(); }
function redo(){ const e = redoStack.pop(); if(!e) return; applyForward(e); undoStack.push(e); saveTasks(); render(); updateHistoryButtons(); }
function applyForward(e){ switch(e.type){ case 'toggle': { const t=tasks.find(x=>x.id===e.id); if(t) t.isDone=e.after.isDone; break; } case 'delete': { tasks.splice(e.index,0,e.task); break; } case 'update': { const t=tasks.find(x=>x.id===e.id); if(t) Object.assign(t,e.after); break; } case 'bulkDelete': { tasks = tasks.filter(t=>!e.tasks.some(r=>r.id===t.id)); break; } case 'bulkToggle': { e.items.forEach(it=>{ const t=tasks.find(x=>x.id===it.id); if(t) t.isDone=true; }); break; } case 'reorder': { reorderTo(e.after); break; } default: break; } }
function applyInverse(e){ switch(e.type){ case 'toggle': { const t=tasks.find(x=>x.id===e.id); if(t) t.isDone=e.before.isDone; break; } case 'delete': { const idx=tasks.findIndex(t=>t.id===e.task.id); if(idx!==-1) tasks.splice(idx,1); tasks.splice(e.index,0,e.task); break; } case 'update': { const t=tasks.find(x=>x.id===e.id); if(t) Object.assign(t,e.before); break; } case 'bulkDelete': { tasks = tasks.concat(e.tasks); tasks.sort((a,b)=>b.createdAt-a.createdAt); break; } case 'bulkToggle': { e.items.forEach(it=>{ const t=tasks.find(x=>x.id===it.id); if(t) t.isDone=false; }); break; } case 'reorder': { reorderTo(e.before); break; } default: break; } }
function reorderTo(order){ tasks.sort((a,b)=> order.indexOf(a.id)-order.indexOf(b.id)); }
btnUndo?.addEventListener('click', undo); btnRedo?.addEventListener('click', redo);
document.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey) && e.key==='z' && !e.shiftKey){ if(document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return; e.preventDefault(); undo(); } else if((e.ctrlKey||e.metaKey) && (e.key==='y' || (e.key==='Z'&& e.shiftKey))){ if(document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return; e.preventDefault(); redo(); } });
updateHistoryButtons();

// =============================
// Service Worker Registration
// =============================
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./service-worker.js').then(reg=>{
      // Optional: listen for updates
      if(reg.waiting){ console.log('Service worker installed (waiting)'); }
      reg.addEventListener('updatefound', ()=>{
        const nw = reg.installing; if(nw){ nw.addEventListener('statechange', ()=>{ if(nw.state==='installed' && navigator.serviceWorker.controller){ console.log('New version available. Refresh to update.'); } }); }
      });
    }).catch(err=>console.warn('SW registration failed', err));
  });
}

// =============================
// Relation Graph Visualization
// =============================
btnMap?.addEventListener('click', ()=>{ mapModal.classList.remove('hidden'); if(!graphInitialized){ initGraph(); graphInitialized=true; } else { rebuildGraph(); } });
mapClose?.addEventListener('click', ()=> mapModal.classList.add('hidden'));

// Simple force layout implementation
let nodes=[], links=[]; // nodes: {id, task, x,y,vx,vy,fixed} ; links: {a,b,strength}
let graphCanvas, gctx; let simRunning=true; let zoom=1, offsetX=0, offsetY=0; let dragNode=null; let panMode=false; let lastX=0, lastY=0;
function buildGraphData(){
  const idMap = new Map();
  nodes = tasks.map((t,i)=>{ const n={ id:t.id, task:t, x: (Math.random()*2-1)*200, y:(Math.random()*2-1)*160, vx:0, vy:0 }; idMap.set(t.id,n); return n; });
  links=[];
  tasks.forEach(t=>{ if(Array.isArray(t.relations)) t.relations.forEach(rid=>{ if(idMap.has(rid)){ links.push({ a:idMap.get(t.id), b:idMap.get(rid), strength:1 }); } }); });
}
function initGraph(){ graphCanvas=document.getElementById('graphCanvas'); if(!graphCanvas) return; gctx=graphCanvas.getContext('2d'); attachGraphEvents(); rebuildGraph(); requestAnimationFrame(tickGraph); }
function rebuildGraph(){ buildGraphData(); }
function tickGraph(){ if(simRunning) stepSimulation(); drawGraph(); requestAnimationFrame(tickGraph); }
function stepSimulation(){ const repulsion=9000; const spring=0.04; const damping=0.85; const centerForce=0.005; nodes.forEach(n=>{ nodes.forEach(m=>{ if(n===m) return; let dx=n.x-m.x; let dy=n.y-m.y; let dist=Math.sqrt(dx*dx+dy*dy)+0.01; let force=repulsion/(dist*dist); n.vx += force*dx/dist; n.vy += force*dy/dist; }); }); links.forEach(l=>{ let dx=l.a.x-l.b.x; let dy=l.a.y-l.b.y; let dist=Math.sqrt(dx*dx+dy*dy)||1; let target=90; let diff = (dist-target)*spring; let fx= diff*dx/dist; let fy= diff*dy/dist; l.a.vx -= fx; l.a.vy -= fy; l.b.vx += fx; l.b.vy += fy; }); nodes.forEach(n=>{ // center pull
  n.vx += -n.x*centerForce; n.vy += -n.y*centerForce; n.vx*=damping; n.vy*=damping; n.x+=n.vx; n.y+=n.vy; }); }
function drawGraph(){ if(!gctx) return; gctx.clearRect(0,0,graphCanvas.width,graphCanvas.height); gctx.save(); gctx.translate(graphCanvas.width/2 + offsetX, graphCanvas.height/2 + offsetY); gctx.scale(zoom,zoom); // edges
  gctx.lineWidth=1/zoom; gctx.strokeStyle='rgba(160,160,160,0.5)'; links.forEach(l=>{ gctx.beginPath(); gctx.moveTo(l.a.x,l.a.y); gctx.lineTo(l.b.x,l.b.y); gctx.stroke(); }); // nodes
  nodes.forEach(n=>{ const t=n.task; const recurring = t.recurrence && t.recurrence!=='none'; let color = t.isDone? '#2d995b' : (recurring? '#b8860b':'#2c7be5'); gctx.beginPath(); gctx.fillStyle=color; gctx.strokeStyle='#fff'; gctx.lineWidth=1/zoom; gctx.arc(n.x,n.y, 14, 0, Math.PI*2); gctx.fill(); gctx.stroke(); gctx.fillStyle='#fff'; gctx.font=`${10/zoom}px system-ui`; gctx.textAlign='center'; gctx.textBaseline='middle'; let txt = (t.title||'').slice(0,4); gctx.fillText(txt, n.x, n.y); });
  gctx.restore(); }
function graphToWorld(x,y){ const cx=graphCanvas.width/2 + offsetX; const cy=graphCanvas.height/2 + offsetY; return { x:(x-cx)/zoom, y:(y-cy)/zoom }; }
function pickNode(canvasX, canvasY){ const p=graphToWorld(canvasX,canvasY); for(let i=nodes.length-1;i>=0;i--){ const n=nodes[i]; const dx=p.x-n.x, dy=p.y-n.y; if(dx*dx+dy*dy<=14*14) return n; } return null; }
function attachGraphEvents(){ graphCanvas.addEventListener('mousedown',e=>{ lastX=e.offsetX; lastY=e.offsetY; const n=pickNode(e.offsetX,e.offsetY); if(n){ dragNode=n; simRunning=true; } else { panMode=true; } }); graphCanvas.addEventListener('mousemove',e=>{ if(dragNode){ const p=graphToWorld(e.offsetX,e.offsetY); dragNode.x=p.x; dragNode.y=p.y; dragNode.vx=dragNode.vy=0; } else if(panMode){ offsetX += (e.offsetX-lastX); offsetY += (e.offsetY-lastY); lastX=e.offsetX; lastY=e.offsetY; } }); graphCanvas.addEventListener('mouseup',()=>{ dragNode=null; panMode=false; }); graphCanvas.addEventListener('mouseleave',()=>{ dragNode=null; panMode=false; }); graphCanvas.addEventListener('wheel',e=>{ e.preventDefault(); const delta = e.deltaY>0? 0.9:1.1; zoom*=delta; zoom=Math.min(Math.max(zoom,0.3),2.5); }); graphCanvas.addEventListener('click',e=>{ const n=pickNode(e.offsetX,e.offsetY); if(n){ focusTaskCard(n.id); } }); document.getElementById('graphReset')?.addEventListener('click',()=>{ zoom=1; offsetX=offsetY=0; }); document.getElementById('graphPause')?.addEventListener('click', (e)=>{ simRunning=!simRunning; e.target.textContent= simRunning? 'Pause':'Play'; }); document.getElementById('graphCenter')?.addEventListener('click',()=>{ // recalc centroid
    if(!nodes.length) return; let cx=0, cy=0; nodes.forEach(n=>{cx+=n.x; cy+=n.y;}); cx/=nodes.length; cy/=nodes.length; nodes.forEach(n=>{ n.x-=cx; n.y-=cy; }); }); }
function focusTaskCard(id){ const el = document.querySelector(`.task[data-id="${id}"]`); if(el){ mapModal.classList.add('hidden'); el.classList.add('highlight'); el.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=>el.classList.remove('highlight'),1500); }}
// Rebuild graph whenever tasks mutate significantly
const originalAddTask = addTask; addTask = function(){ const res=originalAddTask.apply(this,arguments); if(graphInitialized) rebuildGraph(); return res; };
const originalDeleteTask = deleteTask; deleteTask = function(id){ originalDeleteTask(id); if(graphInitialized) rebuildGraph(); };
const originalUpdateTask = updateTask; updateTask = function(id,data){ originalUpdateTask(id,data); if(graphInitialized) rebuildGraph(); };
