// Main Application Controller
class TodoApp {
  constructor() {
    this.tasks = [];
    this.currentFilter = {};
    this.currentSort = { field: 'created', order: 'desc' };
    this.draggedTask = null;
    this.editingTaskId = null;
    
    this.init();
  }

  async init() {
    // Initialize components
    this.storage = new StorageManager();
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
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize UI
    this.ui.render();
    
    // Setup notifications
    this.setupNotifications();
    
    // Check for first visit
    this.checkFirstVisit();
    
    console.log('Todo PWA initialized successfully');
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
      this.importExport.export();
    });

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
      }
    });
  }

  async loadTasks() {
    this.tasks = await this.storage.getTasks();
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
    this.ui.render();
    return task;
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

    // Check for overdue tasks periodically
    setInterval(() => {
      this.checkOverdueTasks();
    }, 60000); // Check every minute

    // Initial check
    setTimeout(() => this.checkOverdueTasks(), 1000);
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.todoApp = new TodoApp();
});