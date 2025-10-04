// Main Application Controller
class TodoApp {
  constructor() {
    this.tasks = [];
    this.currentFilter = {};
    this.currentSort = { field: 'created', order: 'desc' };
    this.draggedTask = null;
    this.editingTaskId = null;
    this.userNamespace = 'public';
    
    this.init();
  }

  async init() {
    // Auth first via adapter service
    if (!this.authService) this.authService = new AuthService();
    const user = this.authService.user;
    this.userNamespace = this.authService.namespace();

    // Initialize components (post-auth)
    this.storage = new StorageManager();
    this.storage.namespace = this.userNamespace;
    if (window.TODO_API_BASE && this.authService.adapter instanceof RemoteAuthAdapter) {
      this.remoteTasks = new RemoteTaskService(window.TODO_API_BASE, ()=> this.authService.adapter.accessToken);
      this.setupSyncStatus();
      this.remoteTasks.on('created', ({ tempId, task }) => {
        if(!task || !task.id) return;
        // If tempId exists locally, remap
        if(tempId && tempId !== task.id){
          this._remapTaskId(tempId, task.id);
          this.ui.render();
        }
      });
    }
    this.ui = new UIManager(this);
    this.search = new SearchManager(this);
    this.stats = new StatsManager(this);
    this.graph = new GraphManager(this);
    this.tour = new TourManager(this);
    this.notifications = new NotificationManager();
    this.themes = new ThemeManager();
    this.importExport = new ImportExportManager(this);
    this.undoRedo = new UndoRedoManager(this);

    // Load tasks from storage
    await this.loadTasks();
    // Notify if any tasks quarantined during load
    if (this.storage.lastQuarantinedCount) {
      setTimeout(()=> this.notifications.showQuarantineSummary(this.storage.lastQuarantinedCount), 500);
    }
    
    // Setup event listeners
  this.setupEventListeners();
  this.setupAuthUI();
  this.setupFocusEvents();
    
    // Initialize UI
    this.ui.render();
    
    // Setup notifications
    this.setupNotifications();
  this.setupGlobalErrorHandlers();
    
    // Check for first visit
    this.checkFirstVisit();
    
    console.log('Todo PWA initialized successfully');
  }
  setupSyncStatus(){
    const el = document.getElementById('syncStatus');
    if(!el || !this.remoteTasks) return;
    const render = ()=> {
      const st = this.remoteTasks.status;
      el.dataset.state = st;
      if(st==='offline') el.textContent = 'Offline';
      else if(st==='syncing') el.textContent = 'Syncing...';
      else if(st==='queued') el.textContent = 'Queued '+this.remoteTasks.queue.length;
      else el.textContent = 'Synced';
    };
    this.remoteTasks.on('status', render);
    this.remoteTasks.on('queue', render);
    render();
  }

  setupFocusEvents() {
    const overlay = document.getElementById('focusOverlay');
    if (!overlay) return;
    const closeBtn = document.getElementById('focusClose');
    const nextBtn = document.getElementById('focusNext');
    const prevBtn = document.getElementById('focusPrev');
    const toggleBtn = document.getElementById('focusToggleComplete');
    const editBtn = document.getElementById('focusEdit');
    const snooze15 = document.getElementById('focusSnooze15');
    const snooze60 = document.getElementById('focusSnooze60');
    const addCal = document.getElementById('focusAddCalendar');
    const copyNotion = document.getElementById('focusCopyNotion');
    closeBtn && closeBtn.addEventListener('click', ()=> this.ui.closeFocus());
    nextBtn && nextBtn.addEventListener('click', ()=> this.focusNext());
    prevBtn && prevBtn.addEventListener('click', ()=> this.focusPrev());
    toggleBtn && toggleBtn.addEventListener('click', ()=> {
      if (!this.ui.focusTaskId) return; this.toggleTask(this.ui.focusTaskId); this.ui.renderFocus(this.ui.focusTaskId);
    });
    editBtn && editBtn.addEventListener('click', ()=> {
      if (!this.ui.focusTaskId) return; this.ui.closeFocus(); this.ui.editTask(this.ui.focusTaskId);
    });
    snooze15 && snooze15.addEventListener('click', ()=> {
      const task = this.tasks.find(t=>t.id===this.ui.focusTaskId); if (!task) return; const d=new Date(); d.setMinutes(d.getMinutes()+15); task.reminderAt=d.toISOString(); task.reminderDismissed=false; this.saveTasks(); this.notifications.show('Reminder snoozed 15m','success');
    });
    snooze60 && snooze60.addEventListener('click', ()=> {
      const task = this.tasks.find(t=>t.id===this.ui.focusTaskId); if (!task) return; const d=new Date(); d.setHours(d.getHours()+1); task.reminderAt=d.toISOString(); task.reminderDismissed=false; this.saveTasks(); this.notifications.show('Reminder snoozed 1h','success');
    });
    addCal && addCal.addEventListener('click', ()=> {
      const task = this.tasks.find(t=>t.id===this.ui.focusTaskId); if (!task) return;
      if (!task.dueDate) { this.notifications.show('Task has no due date','warning'); return; }
      const start = new Date(task.dueDate);
      const end = new Date(start.getTime() + 60*60*1000);
      const fmt = d => d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
      const params = new URLSearchParams({
        action:'TEMPLATE',
        text: task.title,
        dates: `${fmt(start)}/${fmt(end)}`,
        details: task.description || '',
        trp:'false'
      });
      const url = 'https://calendar.google.com/calendar/render?' + params.toString();
      window.open(url,'_blank');
    });
    copyNotion && copyNotion.addEventListener('click', async ()=> {
      const task = this.tasks.find(t=>t.id===this.ui.focusTaskId); if (!task) return;
      const lines = [];
      lines.push(`- [${task.completed ? 'x':' '}] ${task.title}`);
      if (task.description) lines.push(`  - ${task.description.replace(/\n/g,' ')}`);
      if (task.dueDate) lines.push(`  - Due: ${new Date(task.dueDate).toLocaleString()}`);
      if (task.reminderAt && !task.reminderDismissed) lines.push(`  - Reminder: ${new Date(task.reminderAt).toLocaleString()}`);
      if (task.tags && task.tags.length) lines.push('  - Tags: ' + task.tags.map(t=>`#${t}`).join(' '));
      if (task.priority) lines.push('  - Priority: ' + task.priority);
      if (task.relations && task.relations.length) {
        const names = task.relations.map(id=>{ const r=this.tasks.find(x=>x.id===id); return r? r.title:'Unknown'; });
        lines.push('  - Related: ' + names.join(', '));
      }
      try { await navigator.clipboard.writeText(lines.join('\n')); this.notifications.show('Copied Notion block','success'); }
      catch { this.notifications.show('Clipboard failed','error'); }
    });
    overlay.addEventListener('click', (e)=> { if (e.target === overlay) this.ui.closeFocus(); });
  }

  setupAuthUI() {
    const loginOpenBtn = document.getElementById('loginOpenBtn');
    const userMenu = document.getElementById('userMenu');
    const userAvatarBtn = document.getElementById('userAvatarBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const authArea = document.getElementById('authArea');
    const usernameLabel = document.getElementById('currentUsername');
    const authModal = document.getElementById('authModal');
    const authForm = document.getElementById('authForm');
    const authRegisterBtn = document.getElementById('authRegisterBtn');
    const authError = document.getElementById('authError');

    if (loginOpenBtn) {
      loginOpenBtn.addEventListener('click', () => {
        authModal.classList.add('active');
      });
    }
    if (userAvatarBtn) {
      userAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenu.classList.toggle('active');
      });
    }
    document.addEventListener('click', (e) => {
      if (!authArea.contains(e.target)) userMenu.classList.remove('active');
    });
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await this.authService.logout();
        location.reload();
      });
    }
    if (authRegisterBtn) {
      authRegisterBtn.addEventListener('click', async () => {
        const u = document.getElementById('authUsername').value;
        const p = document.getElementById('authPassword').value;
        try { await this.authService.signup(u,p); authError.textContent='Registered! Now login.'; authError.style.display='block'; }
        catch(e){ authError.textContent = e.message; authError.style.display='block'; }
      });
    }
    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('authUsername').value;
        const p = document.getElementById('authPassword').value;
        try { await this.authService.login(u,p); authModal.classList.remove('active'); this.userNamespace = this.authService.namespace(); this.storage.namespace = this.userNamespace; this.setupAuthUI(); this.notifications.show(`Welcome ${u}!`,'success'); }
        catch(err){ authError.textContent = err.message; authError.style.display='block'; }
      });
    }
    if (this.authService.user) {
      loginOpenBtn.classList.add('hidden');
      userMenu.classList.remove('hidden');
      usernameLabel.textContent = this.authService.user.username;
    } else {
      loginOpenBtn.classList.remove('hidden');
      userMenu.classList.add('hidden');
    }
  }

  setupEventListeners() {
    // Header actions
    document.getElementById('addTaskBtn').addEventListener('click', () => {
      this.ui.showTaskModal();
    });

    document.getElementById('statsBtn').addEventListener('click', () => {
      this.stats.show();
    });

    document.getElementById('relationshipBtn').addEventListener('click', () => {
      this.graph.show();
    });

    document.getElementById('themeBtn').addEventListener('click', () => {
      this.themes.toggle();
    });

    document.getElementById('helpBtn').addEventListener('click', () => {
      this.tour.start();
    });

    // Menu dropdown
    const menuBtn = document.getElementById('menuBtn');
    const dropdown = menuBtn.parentElement;
    
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('active');
    });

    // Import/Export
    document.getElementById('importBtn').addEventListener('click', () => {
      this.importExport.import();
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
      this.importExport.showExportChooser();
    });
    const quarantineBtn = document.getElementById('quarantineBtn');
    if (quarantineBtn) quarantineBtn.addEventListener('click', ()=> this.showQuarantineManager());

    // Undo/Redo
    document.getElementById('undoBtn').addEventListener('click', () => {
      this.undoRedo.undo();
    });

    document.getElementById('redoBtn').addEventListener('click', () => {
      this.undoRedo.redo();
    });

    // Search and filters
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.search.setQuery(e.target.value);
    });

    document.getElementById('clearSearch').addEventListener('click', () => {
      this.search.clear();
    });

    document.getElementById('statusFilter').addEventListener('change', (e) => {
      this.setFilter({ status: e.target.value });
    });

    document.getElementById('tagFilter').addEventListener('change', (e) => {
      this.setFilter({ tag: e.target.value });
    });

    document.getElementById('sortBy').addEventListener('change', (e) => {
      this.setSort({ field: e.target.value });
    });

    document.getElementById('sortOrder').addEventListener('click', () => {
      const newOrder = this.currentSort.order === 'asc' ? 'desc' : 'asc';
      this.setSort({ order: newOrder });
    });

    // Task form
    document.getElementById('taskForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.ui.saveTask();
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
      this.ui.hideTaskModal();
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        modal.classList.remove('active');
      });
    });

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              this.undoRedo.redo();
            } else {
              this.undoRedo.undo();
            }
            break;
          case 'n':
            e.preventDefault();
            this.ui.showTaskModal();
            break;
          case 'f':
            e.preventDefault();
            document.getElementById('searchInput').focus();
            break;
        }
      }
      
      if (e.key === 'Escape') {
        this.ui.closeModals();
        if (document.getElementById('focusOverlay') && !document.getElementById('focusOverlay').classList.contains('hidden')) {
          this.ui.closeFocus();
        }
      }
      // Focus Mode keyboard nav
      if (!document.getElementById('focusOverlay').classList.contains('hidden')) {
        if (e.key === 'ArrowRight') this.focusNext();
        if (e.key === 'ArrowLeft') this.focusPrev();
      }
    });
  }

  focusIndexList() {
    return this.getFilteredTasks().map(t=>t.id);
  }
  focusNext() {
    const ids = this.focusIndexList();
    const idx = ids.indexOf(this.ui.focusTaskId);
    if (idx > -1 && idx < ids.length-1) this.ui.renderFocus(ids[idx+1]);
  }
  focusPrev() {
    const ids = this.focusIndexList();
    const idx = ids.indexOf(this.ui.focusTaskId);
    if (idx > 0) this.ui.renderFocus(ids[idx-1]);
  }

  async loadTasks() {
    // Prefer remote if available
    if (this.remoteTasks && this.authService.user) {
      try {
        const remote = await this.remoteTasks.fetchAll();
        this.tasks = remote.map(r=> new Task(r));
        // Persist locally as cache
        await this.storage.saveTasks(this.tasks);
        this.notifications && this.notifications.info && this.notifications.info('Synced from server');
      } catch(e){
        console.warn('Remote fetch failed, falling back to local', e);
        this.tasks = await this.storage.getTasks();
      }
    } else {
      this.tasks = await this.storage.getTasks();
    }
    this.processRecurringTasks();
  }

  async saveTasks() {
    await this.storage.saveTasks(this.tasks);
  }

  addTask(taskData) {
    const task = new Task(taskData);
    this.tasks.unshift(task);
    this.undoRedo.saveState();
    this.saveTasks();
    if (this.remoteTasks && this.authService.user) {
      this.remoteTasks.create(task).then(remote=>{
        if(remote && remote.id && remote.id.startsWith('tmp_')===false) {
          // Replace local task id if different
          if(task.id !== remote.id){
            this._remapTaskId(task.id, remote.id);
          }
        }
      }).catch(()=>{/* queued or offline handled internally */});
    }
    this.ui.render();
    this.notifications.show('Task added successfully', 'success');
    return task;
  }

  updateTask(id, updates) {
    const taskIndex = this.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return null;

    this.undoRedo.saveState();
    Object.assign(this.tasks[taskIndex], updates);
    this.tasks[taskIndex].updatedAt = new Date().toISOString();
    
    this.saveTasks();
    if (this.remoteTasks && this.authService.user) {
      this.remoteTasks.update(this.tasks[taskIndex]).catch(()=>{});
    }
    this.ui.render();
    this.notifications.show('Task updated successfully', 'success');
    return this.tasks[taskIndex];
  }

  deleteTask(id) {
    const taskIndex = this.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return false;

    this.undoRedo.saveState();
    const task = this.tasks.splice(taskIndex, 1)[0];
    
    this.saveTasks();
    if (this.remoteTasks && this.authService.user) {
      this.remoteTasks.remove(id).catch(()=>{});
    }
    this.ui.render();
    this.notifications.show('Task deleted successfully', 'success');
    return true;
  }

  toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return null;

    this.undoRedo.saveState();
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.updatedAt = new Date().toISOString();

    if (task.completed && task.recurrence) {
      this.createRecurringTask(task);
    }

    this.saveTasks();
    if (this.remoteTasks && this.authService.user) {
      this.remoteTasks.toggle(id).catch(()=>{});
    }
    this.ui.render();
    return task;
  }

  _remapTaskId(oldId, newId){
    const task = this.tasks.find(t=>t.id===oldId);
    if(task){ task.id = newId; }
    // Update relations referencing old id
    this.tasks.forEach(t=>{
      if(t.relations && t.relations.includes(oldId)){
        t.relations = t.relations.map(r=> r===oldId ? newId : r);
      }
    });
    // Persist change
    this.storage.saveTasks(this.tasks);
  }

  createRecurringTask(completedTask) {
    const newDueDate = this.calculateNextDueDate(completedTask.dueDate, completedTask.recurrence);
    if (!newDueDate) return;

    const newTask = new Task({
      title: completedTask.title,
      description: completedTask.description,
      dueDate: newDueDate,
      priority: completedTask.priority,
      tags: [...completedTask.tags],
      recurrence: completedTask.recurrence,
      relations: completedTask.relations ? [...completedTask.relations] : []
    });

    this.tasks.unshift(newTask);
    this.notifications.show('Recurring task created', 'success');
  }

  calculateNextDueDate(currentDueDate, recurrence) {
    if (!currentDueDate) return null;

    const date = new Date(currentDueDate);
    
    switch (recurrence) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        return null;
    }

    return date.toISOString();
  }

  processRecurringTasks() {
    // This would run on app initialization to create any missed recurring tasks
    // For now, we'll keep it simple and only create recurring tasks when the original is completed
  }

  getFilteredTasks() {
    let filtered = [...this.tasks];

    // Apply search
    if (this.search.query) {
      filtered = this.search.filterTasks(filtered);
    }

    // Apply filters
    if (this.currentFilter.status) {
      filtered = filtered.filter(task => {
        switch (this.currentFilter.status) {
          case 'completed':
            return task.completed;
          case 'pending':
            return !task.completed;
          case 'overdue':
            return !task.completed && task.dueDate && new Date(task.dueDate) < new Date();
          default:
            return true;
        }
      });
    }

    if (this.currentFilter.tag) {
      filtered = filtered.filter(task => 
        task.tags.includes(this.currentFilter.tag)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = this.getSortValue(a, this.currentSort.field);
      const bValue = this.getSortValue(b, this.currentSort.field);

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return this.currentSort.order === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }

  getSortValue(task, field) {
    switch (field) {
      case 'title':
        return task.title.toLowerCase();
      case 'created':
        return new Date(task.createdAt);
      case 'dueDate':
        return task.dueDate ? new Date(task.dueDate) : new Date('2099-12-31');
      case 'priority':
        const priorities = { low: 0, medium: 1, high: 2 };
        return priorities[task.priority] || 0;
      default:
        return task.createdAt;
    }
  }

  setFilter(filter) {
    Object.assign(this.currentFilter, filter);
    this.ui.render();
    this.ui.updateFilterUI();
  }

  setSort(sort) {
    Object.assign(this.currentSort, sort);
    this.ui.render();
    this.ui.updateSortUI();
  }

  reorderTasks(draggedId, targetId, position) {
    const draggedIndex = this.tasks.findIndex(t => t.id === draggedId);
    const targetIndex = this.tasks.findIndex(t => t.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    this.undoRedo.saveState();
    
    const [draggedTask] = this.tasks.splice(draggedIndex, 1);
    
    let insertIndex = targetIndex;
    if (position === 'after') {
      insertIndex = targetIndex + 1;
    }
    
    this.tasks.splice(insertIndex, 0, draggedTask);
    
    this.saveTasks();
    this.ui.render();
  }

  setupNotifications() {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Periodic checks (overdue + reminders)
    setInterval(() => {
      this.checkOverdueTasks();
      this.checkReminders();
    }, 60000);

    setTimeout(() => {
      this.checkOverdueTasks();
      this.checkReminders();
    }, 1000);
  }

  checkOverdueTasks() {
    const now = new Date();
    const overdueTasks = this.tasks.filter(task => 
      !task.completed && 
      task.dueDate && 
      new Date(task.dueDate) < now
    );

    overdueTasks.forEach(task => {
      if (!task.notifiedOverdue) {
        this.notifications.showOverdue(task);
        task.notifiedOverdue = true;
      }
    });

    if (overdueTasks.length > 0) {
      this.saveTasks();
    }
  }

  checkReminders() {
    const now = Date.now();
    this.tasks.forEach(task => {
      if (!task.completed && task.reminderAt && !task.reminderDismissed) {
        const t = new Date(task.reminderAt).getTime();
        if (t <= now) {
          // Show reminder with snooze actions
            this.notifications.showWithActions(`Reminder: "${task.title}"`, 'info', [
              {
                text: 'Snooze 15m',
                handler: () => {
                  const d = new Date();
                  d.setMinutes(d.getMinutes() + 15);
                  task.reminderAt = d.toISOString();
                  this.saveTasks();
                }
              },
              {
                text: 'Snooze 1h',
                handler: () => {
                  const d = new Date();
                  d.setHours(d.getHours() + 1);
                  task.reminderAt = d.toISOString();
                  this.saveTasks();
                }
              },
              {
                text: 'Dismiss',
                handler: () => {
                  task.reminderDismissed = true;
                  this.saveTasks();
                }
              }
            ], 8000);
            // Prevent spamming until user interacts (either snooze resets or dismiss sets flag)
            task.reminderDismissed = true;
            this.saveTasks();
        }
      }
    });
  }

  checkFirstVisit() {
    const hasVisited = localStorage.getItem('todo-pwa-visited');
    if (!hasVisited) {
      localStorage.setItem('todo-pwa-visited', 'true');
      setTimeout(() => {
        this.tour.start();
      }, 1000);
    }
  }

  getAllTags() {
    const tags = new Set();
    this.tasks.forEach(task => {
      task.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  restoreState(state) {
    this.tasks = state.tasks || [];
    this.saveTasks();
    this.ui.render();
  }

  getCurrentState() {
    return {
      tasks: JSON.parse(JSON.stringify(this.tasks))
    };
  }

  setupGlobalErrorHandlers() {
    window.addEventListener('error', (e) => {
      this.notifications.showGlobalError(e.error || e.message || 'Unknown');
    });
    window.addEventListener('unhandledrejection', (e) => {
      this.notifications.showGlobalError(e.reason || 'Promise rejection', 'Unhandled Promise');
    });
  }

  showQuarantineManager() {
    const entries = this.storage.getQuarantinedTasks();
    if (!entries.length) { this.notifications.info('Quarantine empty'); return; }
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:760px; max-height:80vh; overflow:auto;">
        <div class="modal-header"><h2>Quarantine (${entries.length})</h2><button class="btn btn-icon modal-close" aria-label="Close">&times;</button></div>
        <div style="padding:1rem;">
          <p style="font-size:.8rem; line-height:1.4;">These tasks were isolated due to validation errors. You can attempt to restore after fixing JSON, or clear all.</p>
          <div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:.75rem;">
            <button class="btn btn-secondary" data-action="clear">Clear All</button>
            <button class="btn btn-secondary" data-action="autofix-all">Auto-Fix All (Up to 50)</button>
          </div>
          <div style="display:grid; gap:.75rem;">
            ${entries.map((e,i)=>`<div style="background:var(--bg-secondary); padding:.6rem .75rem; border-radius:var(--border-radius);">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:.5rem;">
                <strong style="font-size:.75rem;">Item ${i+1}</strong>
                <div style="display:flex; gap:.4rem;">
                  <button class="btn btn-secondary" data-restore="${i}" style="font-size:.65rem; padding:.2rem .5rem;">Restore</button>
                  <button class="btn btn-secondary" data-autofix="${i}" style="font-size:.65rem; padding:.2rem .5rem;">Auto-Fix</button>
                </div>
              </div>
              <div style="margin-top:.4rem; font-size:.65rem; color:var(--warning);">Errors: ${(e.errors||[]).join(', ')}</div>
              <pre style="margin:.4rem 0 0; font-size:.6rem; max-height:140px; overflow:auto; background:rgba(0,0,0,.2); padding:.4rem; border-radius:4px;">${this.escapeHTML(JSON.stringify(e.original,null,2))}</pre>
            </div>`).join('')}
          </div>
          <div style="text-align:right; margin-top:1rem;"><button class="btn btn-primary" data-close>Close</button></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(()=>modal.classList.add('active'));
    const close=()=>{modal.classList.remove('active'); setTimeout(()=>modal.remove(),250);};
    modal.addEventListener('click', async (e)=>{
      if (e.target===modal || e.target.dataset.close!==undefined || e.target.classList.contains('modal-close')) close();
      if (e.target.dataset.action==='clear') { this.storage.clearQuarantine(); this.notifications.success('Quarantine cleared'); close(); }
      if (e.target.dataset.action==='autofix-all') {
        const res = await this.storage.autoFixAllQuarantined();
        this.notifications.show(`Auto-Fixed ${res.restoredCount} task(s)`, res.restoredCount ? 'success':'info');
        this.ui.render();
        close();
      }
      if (e.target.dataset.restore!==undefined) {
        const idx = parseInt(e.target.dataset.restore,10);
        const res = await this.storage.restoreQuarantined(idx);
        if (res.restored) { this.notifications.success('Task restored'); this.ui.render(); close(); }
        else { this.notifications.error('Restore failed' + (res.errors? ': '+res.errors.join(', '):'')); }
      }
      if (e.target.dataset.autofix!==undefined) {
        const idx = parseInt(e.target.dataset.autofix,10);
        const res = await this.storage.autoFixQuarantined(idx);
        if (res.restored) { this.notifications.success('Auto-Fixed & Restored'); this.ui.render(); close(); }
        else { this.notifications.error('Auto-Fix failed' + (res.errors? ': '+res.errors.join(', '):'')); }
      }
    });
  }

  escapeHTML(str='') { return str.replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.todoApp = new TodoApp();
});