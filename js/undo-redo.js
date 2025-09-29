// Undo/Redo Manager
class UndoRedoManager {
  constructor(app) {
    this.app = app;
    this.history = [];
    this.currentIndex = -1;
    this.maxHistory = 100;
    
    this.init();
  }

  init() {
    // Load history from storage if available
    this.loadHistory();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Update UI
    this.updateUI();
  }

  async loadHistory() {
    try {
      const savedHistory = await this.app.storage.getHistory();
      if (savedHistory && savedHistory.length > 0) {
        this.history = savedHistory.slice(0, this.maxHistory);
        this.currentIndex = Math.max(-1, this.history.length - 1);
      }
    } catch (error) {
      console.warn('Failed to load undo/redo history:', error);
    }
  }

  async saveHistory() {
    try {
      await this.app.storage.saveHistoryState('state_update', {
        history: this.history,
        currentIndex: this.currentIndex
      });
    } catch (error) {
      console.warn('Failed to save undo/redo history:', error);
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          this.undo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          this.redo();
        }
      }
    });
  }

  saveState(action = 'unknown') {
    const state = {
      timestamp: Date.now(),
      action,
      tasks: JSON.parse(JSON.stringify(this.app.tasks.map(t => t.toJSON ? t.toJSON() : t))),
      filters: { ...this.app.currentFilter },
      sort: { ...this.app.currentSort }
    };

    // Remove any states after current index (when user made new changes after undo)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Add new state
    this.history.push(state);
    this.currentIndex = this.history.length - 1;

    // Maintain max history size
    if (this.history.length > this.maxHistory) {
      const removeCount = this.history.length - this.maxHistory;
      this.history.splice(0, removeCount);
      this.currentIndex -= removeCount;
    }

    this.updateUI();
    this.saveHistory();
  }

  undo() {
    if (!this.canUndo()) {
      this.app.notifications.showUndoLimit();
      return false;
    }

    const currentState = this.history[this.currentIndex];
    this.currentIndex--;

    if (this.currentIndex >= 0) {
      const previousState = this.history[this.currentIndex];
      this.restoreState(previousState);
      this.app.notifications.showUndoSuccess(currentState.action);
    } else {
      // No previous state, clear all tasks
      this.app.tasks = [];
      this.app.ui.render();
      this.app.notifications.showUndoSuccess('Clear all tasks');
    }

    this.updateUI();
    return true;
  }

  redo() {
    if (!this.canRedo()) {
      this.app.notifications.showRedoLimit();
      return false;
    }

    this.currentIndex++;
    const nextState = this.history[this.currentIndex];
    
    this.restoreState(nextState);
    this.app.notifications.showRedoSuccess(nextState.action);
    
    this.updateUI();
    return true;
  }

  restoreState(state) {
    // Restore tasks
    this.app.tasks = state.tasks.map(taskData => Task.fromJSON(taskData));
    
    // Restore filters and sort
    this.app.currentFilter = { ...state.filters };
    this.app.currentSort = { ...state.sort };
    
    // Save to storage
    this.app.saveTasks();
    
    // Update UI
    this.app.ui.render();
    this.app.ui.updateFilterUI();
    this.app.ui.updateSortUI();
  }

  canUndo() {
    return this.currentIndex >= 0;
  }

  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  updateUI() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    if (undoBtn) {
      undoBtn.disabled = !this.canUndo();
      undoBtn.title = this.canUndo() 
        ? `Undo: ${this.getLastAction()}` 
        : 'Nothing to undo';
    }

    if (redoBtn) {
      redoBtn.disabled = !this.canRedo();
      redoBtn.title = this.canRedo() 
        ? `Redo: ${this.getNextAction()}` 
        : 'Nothing to redo';
    }
  }

  getLastAction() {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.formatAction(this.history[this.currentIndex].action);
    }
    return 'Unknown action';
  }

  getNextAction() {
    const nextIndex = this.currentIndex + 1;
    if (nextIndex >= 0 && nextIndex < this.history.length) {
      return this.formatAction(this.history[nextIndex].action);
    }
    return 'Unknown action';
  }

  formatAction(action) {
    const actionMap = {
      'add_task': 'Add Task',
      'update_task': 'Update Task',
      'delete_task': 'Delete Task',
      'toggle_task': 'Toggle Task',
      'reorder_tasks': 'Reorder Tasks',
      'batch_complete': 'Complete Multiple Tasks',
      'batch_delete': 'Delete Multiple Tasks',
      'import_tasks': 'Import Tasks',
      'clear_completed': 'Clear Completed Tasks',
      'unknown': 'Unknown Action'
    };

    return actionMap[action] || action;
  }

  // Enhanced state management
  saveStateWithMetadata(action, metadata = {}) {
    const state = {
      timestamp: Date.now(),
      action,
      metadata,
      tasks: JSON.parse(JSON.stringify(this.app.tasks.map(t => t.toJSON ? t.toJSON() : t))),
      filters: { ...this.app.currentFilter },
      sort: { ...this.app.currentSort },
      taskCount: this.app.tasks.length,
      completedCount: this.app.tasks.filter(t => t.completed).length
    };

    this.addState(state);
  }

  addState(state) {
    // Don't save duplicate states
    if (this.isDuplicateState(state)) {
      return;
    }

    // Remove any states after current index
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push(state);
    this.currentIndex = this.history.length - 1;

    // Maintain max history
    this.trimHistory();
    this.updateUI();
    this.saveHistory();
  }

  isDuplicateState(newState) {
    if (this.history.length === 0) return false;
    
    const lastState = this.history[this.history.length - 1];
    
    // Compare task data
    const lastTasks = JSON.stringify(lastState.tasks);
    const newTasks = JSON.stringify(newState.tasks);
    
    return lastTasks === newTasks;
  }

  trimHistory() {
    if (this.history.length > this.maxHistory) {
      const removeCount = this.history.length - this.maxHistory;
      this.history.splice(0, removeCount);
      this.currentIndex = Math.max(-1, this.currentIndex - removeCount);
    }
  }

  // Batch operations
  startBatchOperation() {
    this.batchStartState = this.getCurrentState();
  }

  endBatchOperation(action) {
    if (this.batchStartState) {
      const currentState = this.getCurrentState();
      
      // Only save if there were actual changes
      if (JSON.stringify(this.batchStartState.tasks) !== JSON.stringify(currentState.tasks)) {
        this.saveStateWithMetadata(action, {
          batchOperation: true,
          changesCount: this.calculateChanges(this.batchStartState, currentState)
        });
      }
      
      this.batchStartState = null;
    }
  }

  getCurrentState() {
    return {
      tasks: JSON.parse(JSON.stringify(this.app.tasks.map(t => t.toJSON ? t.toJSON() : t))),
      filters: { ...this.app.currentFilter },
      sort: { ...this.app.currentSort }
    };
  }

  calculateChanges(oldState, newState) {
    const changes = {
      added: 0,
      modified: 0,
      deleted: 0
    };

    const oldTaskMap = new Map(oldState.tasks.map(t => [t.id, t]));
    const newTaskMap = new Map(newState.tasks.map(t => [t.id, t]));

    // Count added tasks
    newTaskMap.forEach((task, id) => {
      if (!oldTaskMap.has(id)) {
        changes.added++;
      }
    });

    // Count deleted and modified tasks
    oldTaskMap.forEach((oldTask, id) => {
      if (!newTaskMap.has(id)) {
        changes.deleted++;
      } else {
        const newTask = newTaskMap.get(id);
        if (JSON.stringify(oldTask) !== JSON.stringify(newTask)) {
          changes.modified++;
        }
      }
    });

    return changes;
  }

  // History navigation
  jumpToState(index) {
    if (index < 0 || index >= this.history.length) {
      return false;
    }

    this.currentIndex = index;
    const state = this.history[index];
    this.restoreState(state);
    this.updateUI();
    
    this.app.notifications.info(`Jumped to: ${this.formatAction(state.action)}`, 3000);
    return true;
  }

  // History inspection
  getHistoryPreview() {
    return this.history.map((state, index) => ({
      index,
      action: this.formatAction(state.action),
      timestamp: new Date(state.timestamp).toLocaleString(),
      taskCount: state.taskCount || state.tasks.length,
      isCurrent: index === this.currentIndex,
      metadata: state.metadata || {}
    }));
  }

  showHistoryDialog() {
    const modal = this.createHistoryDialog();
    document.body.appendChild(modal);
    
    requestAnimationFrame(() => {
      modal.classList.add('active');
    });
  }

  createHistoryDialog() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '2000';

    const preview = this.getHistoryPreview();
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px; max-height: 80vh;">
        <div class="modal-header">
          <h2>Action History</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div style="padding: 1.5rem; overflow-y: auto;">
          ${preview.length === 0 ? 
            '<p>No history available</p>' :
            `<div class="history-list">
              ${preview.reverse().map(item => `
                <div class="history-item ${item.isCurrent ? 'current' : ''}" 
                     data-index="${item.index}"
                     style="
                       padding: 0.75rem;
                       border: 1px solid var(--border-color);
                       border-radius: var(--border-radius);
                       margin-bottom: 0.5rem;
                       cursor: pointer;
                       background: ${item.isCurrent ? 'var(--primary-color)' : 'var(--bg-secondary)'};
                       color: ${item.isCurrent ? 'white' : 'inherit'};
                     ">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>${item.action}</strong>
                    <span style="font-size: 0.8rem; opacity: 0.8;">${item.taskCount} tasks</span>
                  </div>
                  <div style="font-size: 0.8rem; opacity: 0.8; margin-top: 0.25rem;">
                    ${item.timestamp}
                  </div>
                  ${item.metadata.batchOperation ? 
                    '<div style="font-size: 0.7rem; margin-top: 0.25rem;">Batch operation</div>' : 
                    ''
                  }
                </div>
              `).join('')}
            </div>`
          }
          
          <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
            <div style="display: flex; gap: 0.75rem; justify-content: space-between;">
              <div style="font-size: 0.9rem; color: var(--text-secondary);">
                ${this.history.length}/${this.maxHistory} states saved
              </div>
              <div>
                <button class="btn btn-secondary clear-history">Clear History</button>
                <button class="btn btn-secondary modal-close">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-close')) {
        this.closeModal(modal);
      } else if (e.target.classList.contains('clear-history')) {
        if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
          this.clearHistory();
          this.closeModal(modal);
        }
      } else {
        const historyItem = e.target.closest('.history-item');
        if (historyItem && !historyItem.classList.contains('current')) {
          const index = parseInt(historyItem.dataset.index);
          this.jumpToState(index);
          this.closeModal(modal);
        }
      }
    });

    return modal;
  }

  closeModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
  }

  // History management
  clearHistory() {
    this.history = [];
    this.currentIndex = -1;
    this.updateUI();
    this.saveHistory();
    this.app.notifications.info('History cleared', 3000);
  }

  setMaxHistory(max) {
    this.maxHistory = Math.max(1, Math.min(max, 500)); // Limit between 1 and 500
    this.trimHistory();
    this.updateUI();
  }

  // Statistics
  getStats() {
    const actions = this.history.reduce((acc, state) => {
      acc[state.action] = (acc[state.action] || 0) + 1;
      return acc;
    }, {});

    return {
      totalStates: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      mostCommonAction: Object.entries(actions)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none',
      actionBreakdown: actions,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  estimateMemoryUsage() {
    try {
      const historySize = JSON.stringify(this.history).length * 2; // UTF-16 bytes
      return {
        bytes: historySize,
        kb: Math.round(historySize / 1024 * 10) / 10,
        mb: Math.round(historySize / (1024 * 1024) * 100) / 100
      };
    } catch {
      return { bytes: 0, kb: 0, mb: 0 };
    }
  }

  // Export/Import history
  exportHistory() {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      maxHistory: this.maxHistory,
      currentIndex: this.currentIndex,
      history: this.history
    };
  }

  importHistory(data) {
    if (!data.version || !data.history) {
      throw new Error('Invalid history data');
    }

    this.history = data.history.slice(0, this.maxHistory);
    this.currentIndex = Math.min(data.currentIndex || -1, this.history.length - 1);
    
    this.updateUI();
    this.saveHistory();
  }
}