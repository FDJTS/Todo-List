// Storage Manager for Local Storage and IndexedDB
class StorageManager {
  constructor() {
    this.dbName = 'TodoPWA';
    this.dbVersion = 1;
    this.db = null;
    this.fallbackToLocalStorage = false;
    // Namespace support (set externally after auth)
    this.namespace = 'public';
    this.safeJson = {
      parse(str, fallback) {
        try {
          return JSON.parse(str);
        } catch (e) {
          console.warn('JSON parse failed, using fallback.', e);
          return fallback;
        }
      },
      stringify(obj, fallback = '[]') {
        try {
          return JSON.stringify(obj);
        } catch (e) {
          console.warn('JSON stringify failed, returning fallback.', e);
          return fallback;
        }
      }
    };
    
    this.init();
  }

  async init() {
    try {
      await this.initIndexedDB();
    } catch (error) {
      console.warn('IndexedDB not available, falling back to localStorage:', error);
      this.fallbackToLocalStorage = true;
    }
  }

  initIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('completed', 'completed');
          tasksStore.createIndex('dueDate', 'dueDate');
          tasksStore.createIndex('priority', 'priority');
          tasksStore.createIndex('createdAt', 'createdAt');
        }
        
        // Create settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        
        // Create history store for undo/redo
        if (!db.objectStoreNames.contains('history')) {
          const historyStore = db.createObjectStore('history', { keyPath: 'timestamp' });
          historyStore.createIndex('action', 'action');
        }
      };
    });
  }

  async getTasks() {
    if (this.fallbackToLocalStorage) {
      return this.getTasksFromLocalStorage();
    }
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve([]);
        return;
      }
      
      const transaction = this.db.transaction(['tasks'], 'readonly');
      const store = transaction.objectStore('tasks');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const raw = request.result;
        const { validTasks, quarantined } = this.filterAndQuarantine(raw);
        if (quarantined.length) this.persistQuarantine(quarantined);
        this.lastQuarantinedCount = quarantined.length;
        resolve(validTasks.map(taskData => Task.fromJSON(taskData)));
      };
      
      request.onerror = () => {
        console.error('Error loading tasks from IndexedDB:', request.error);
        resolve([]);
      };
    });
  }

  async saveTasks(tasks) {
    if (this.fallbackToLocalStorage) {
      return this.saveTasksToLocalStorage(tasks);
    }
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      
      const transaction = this.db.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');
      
      // Clear existing tasks
      store.clear();
      
      // Add all tasks
      tasks.forEach(task => {
        store.add(task.toJSON ? task.toJSON() : task);
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        console.error('Error saving tasks to IndexedDB:', transaction.error);
        resolve();
      };
    });
  }

  getTasksFromLocalStorage() {
    const tasksData = localStorage.getItem(`${this.namespace}-todo-pwa-tasks`);
    if (!tasksData) return [];
    const parsed = this.safeJson.parse(tasksData, []);
    if (!Array.isArray(parsed)) return [];
    const { validTasks, quarantined } = this.filterAndQuarantine(parsed);
    if (quarantined.length) this.persistQuarantine(quarantined);
    this.lastQuarantinedCount = quarantined.length;
    return validTasks.map(taskData => Task.fromJSON(taskData));
  }

  saveTasksToLocalStorage(tasks) {
    const tasksData = tasks.map(task => task.toJSON ? task.toJSON() : task);
    const serialized = this.safeJson.stringify(tasksData, '[]');
    try { localStorage.setItem(`${this.namespace}-todo-pwa-tasks`, serialized); return true; } catch (e) { console.error('Error saving tasks to localStorage:', e); return false; }
  }

  async getSetting(key, defaultValue = null) {
    if (this.fallbackToLocalStorage) {
      const value = localStorage.getItem(`todo-pwa-setting-${key}`);
      if (value === null) {
        const namespaced = localStorage.getItem(`${this.namespace}-todo-pwa-setting-${key}`);
        if (namespaced !== null) return this.safeJson.parse(namespaced, defaultValue);
      }
      return value !== null ? this.safeJson.parse(value, defaultValue) : defaultValue;
    }
    
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(defaultValue);
        return;
      }
      
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };
      
      request.onerror = () => {
        resolve(defaultValue);
      };
    });
  }

  async setSetting(key, value) {
    if (this.fallbackToLocalStorage) {
      try { localStorage.setItem(`todo-pwa-setting-${key}`, this.safeJson.stringify(value, 'null')); return true; } catch { return false; }
    } else {
      try { localStorage.setItem(`${this.namespace}-todo-pwa-setting-${key}`, this.safeJson.stringify(value, 'null')); return true; } catch { return false; }
    }
    
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(false);
        return;
      }
      
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async saveHistoryState(action, state) {
    const historyEntry = {
      timestamp: Date.now(),
      action,
      state: JSON.parse(JSON.stringify(state))
    };
    
    if (this.fallbackToLocalStorage) {
      const history = this.safeJson.parse(localStorage.getItem('todo-pwa-history') || '[]', []);
      history.push(historyEntry);
      if (history.length > 100) history.splice(0, history.length - 100);
      try { localStorage.setItem('todo-pwa-history', this.safeJson.stringify(history, '[]')); return true; } catch { return false; }
    }
    
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(false);
        return;
      }
      
      const transaction = this.db.transaction(['history'], 'readwrite');
      const store = transaction.objectStore('history');
      
      // Add new entry
      store.add(historyEntry);
      
      // Clean up old entries (keep only last 100)
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const allEntries = getAllRequest.result;
        if (allEntries.length > 100) {
          const entriesToDelete = allEntries
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(100);
          
          entriesToDelete.forEach(entry => {
            store.delete(entry.timestamp);
          });
        }
      };
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    });
  }

  async getHistory() {
    if (this.fallbackToLocalStorage) {
      return this.safeJson.parse(localStorage.getItem('todo-pwa-history') || '[]', []);
    }
    
    return new Promise((resolve) => {
      if (!this.db) {
        resolve([]);
        return;
      }
      
      const transaction = this.db.transaction(['history'], 'readonly');
      const store = transaction.objectStore('history');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const history = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(history);
      };
      
      request.onerror = () => resolve([]);
    });
  }

  async clearHistory() {
    if (this.fallbackToLocalStorage) {
      try {
        localStorage.removeItem('todo-pwa-history');
        return true;
      } catch {
        return false;
      }
    }
    
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(false);
        return;
      }
      
      const transaction = this.db.transaction(['history'], 'readwrite');
      const store = transaction.objectStore('history');
      const request = store.clear();
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  async exportData() {
    const tasks = await this.getTasks();
    const settings = {};
    
    // Export key settings
    const settingsKeys = ['theme', 'tourCompleted', 'notifications'];
    for (const key of settingsKeys) {
      settings[key] = await this.getSetting(key);
    }
    
    return {
      version: '3.0',
      exportDate: new Date().toISOString(),
      tasks: tasks.map(task => task.toJSON ? task.toJSON() : task),
      settings,
      metadata: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.completed).length,
        tags: [...new Set(tasks.flatMap(t => t.tags))]
      }
    };
  }

  async importData(data) {
    if (!data.version || !data.tasks) {
      throw new Error('Invalid import data format');
    }
    
    // Version compatibility check
    if (data.version.startsWith('3.')) {
      // Current version, import directly
      const tasks = data.tasks.map(taskData => Task.fromJSON(taskData));
      await this.saveTasks(tasks);
      
      // Import settings
      if (data.settings) {
        for (const [key, value] of Object.entries(data.settings)) {
          if (value !== undefined && value !== null) {
            await this.setSetting(key, value);
          }
        }
      }
      
      return {
        success: true,
        tasksImported: tasks.length,
        settingsImported: data.settings ? Object.keys(data.settings).length : 0
      };
    } else {
      throw new Error(`Unsupported import version: ${data.version}`);
    }
  }

  async getStorageStats() {
    const tasks = await this.getTasks();
    const history = await this.getHistory();
    
    let storageUsed = 0;
    
    if (this.fallbackToLocalStorage) {
      // Estimate localStorage usage
      const tasksSize = JSON.stringify(tasks).length * 2; // UTF-16 bytes
      const historySize = JSON.stringify(history).length * 2;
      storageUsed = tasksSize + historySize;
    } else if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        storageUsed = estimate.usage || 0;
      } catch {
        storageUsed = 0;
      }
    }
    
    return {
      tasksCount: tasks.length,
      historyCount: history.length,
      storageUsed,
      storageType: this.fallbackToLocalStorage ? 'localStorage' : 'IndexedDB'
    };
  }

  async clearAllData() {
    if (this.fallbackToLocalStorage) {
      // Clear localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('todo-pwa-')) {
          localStorage.removeItem(key);
        }
      });
      return true;
    }
    
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(false);
        return;
      }
      
      const transaction = this.db.transaction(['tasks', 'settings', 'history'], 'readwrite');
      
      transaction.objectStore('tasks').clear();
      transaction.objectStore('settings').clear();
      transaction.objectStore('history').clear();
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    });
  }

  // --- Quarantine & Validation Helpers ---
  filterAndQuarantine(rawArray) {
    const validTasks = [];
    const quarantined = [];
    if (!Array.isArray(rawArray)) return { validTasks, quarantined };
    rawArray.forEach(obj => {
      try {
        const candidate = new Task(obj);
        const { isValid, errors } = candidate.validate();
        // sanity check for required shape
        if (!isValid) {
          quarantined.push({ original: obj, errors, quarantinedAt: new Date().toISOString() });
        } else if (!candidate.id || typeof candidate.title !== 'string') {
          quarantined.push({ original: obj, errors: ['Missing id/title'], quarantinedAt: new Date().toISOString() });
        } else {
          validTasks.push(obj);
        }
      } catch (e) {
        quarantined.push({ original: obj, errors: ['Construction failed: ' + e.message], quarantinedAt: new Date().toISOString() });
      }
    });
    return { validTasks, quarantined };
  }

  quarantineKey() {
    return `${this.namespace}-todo-pwa-quarantine`;
  }

  persistQuarantine(entries) {
    if (!entries.length) return;
    try {
      const existing = this.safeJson.parse(localStorage.getItem(this.quarantineKey()) || '[]', []);
      existing.push(...entries);
      localStorage.setItem(this.quarantineKey(), this.safeJson.stringify(existing, '[]'));
    } catch (e) {
      console.warn('Failed to persist quarantine', e);
    }
  }

  getQuarantinedTasks() {
    try {
      const arr = this.safeJson.parse(localStorage.getItem(this.quarantineKey()) || '[]', []);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  clearQuarantine() {
    try { localStorage.removeItem(this.quarantineKey()); return true; } catch { return false; }
  }

  async restoreQuarantined(index) {
    const quarantined = this.getQuarantinedTasks();
    if (index < 0 || index >= quarantined.length) return { restored: false };
    const entry = quarantined[index];
    // Re-run validation
    try {
      const candidate = new Task(entry.original);
      const { isValid, errors } = candidate.validate();
      if (!isValid) return { restored: false, errors };
      // Load current tasks, add, save
      const tasks = await this.getTasks(); // already filters others
      tasks.unshift(candidate);
      await this.saveTasks(tasks);
      // remove from quarantine list
      quarantined.splice(index, 1);
      localStorage.setItem(this.quarantineKey(), this.safeJson.stringify(quarantined, '[]'));
      return { restored: true };
    } catch (e) {
      return { restored: false, errors: [e.message] };
    }
  }

  // Attempt to fix an invalid task object in-place and validate again.
  autoFix(original) {
    const fixed = { ...original };
    // Title: ensure string & length
    if (typeof fixed.title !== 'string') fixed.title = String(fixed.title || '').trim();
    if (!fixed.title) fixed.title = 'Recovered Task';
    if (fixed.title.length > 500) fixed.title = fixed.title.slice(0, 500);
    // Description length cap
    if (fixed.description && typeof fixed.description === 'string' && fixed.description.length > 2000) {
      fixed.description = fixed.description.slice(0, 2000) + '…';
    }
    // Priority normalization
    if (!['low','medium','high'].includes(fixed.priority)) fixed.priority = 'medium';
    // Tags normalization
    if (!Array.isArray(fixed.tags)) fixed.tags = [];
    fixed.tags = fixed.tags.filter(t => typeof t === 'string' && t.trim()).map(t=>t.trim().toLowerCase()).slice(0, 50);
    // Dates validation
    const dateFields = ['dueDate','createdAt','updatedAt','completedAt','reminderAt'];
    dateFields.forEach(f => { if (fixed[f] && isNaN(Date.parse(fixed[f]))) fixed[f] = null; });
    if (!fixed.createdAt) fixed.createdAt = new Date().toISOString();
    if (!fixed.updatedAt) fixed.updatedAt = fixed.createdAt;
    // Recurrence sanity
    if (fixed.recurrence && !['daily','weekly','monthly','yearly'].includes(fixed.recurrence)) fixed.recurrence = null;
    // Relations array
    if (!Array.isArray(fixed.relations)) fixed.relations = [];
    // Boolean fields
    fixed.completed = !!fixed.completed;
    fixed.notifiedOverdue = !!fixed.notifiedOverdue;
    fixed.reminderDismissed = !!fixed.reminderDismissed;
    // ID ensure
    if (!fixed.id || typeof fixed.id !== 'string') fixed.id = 'recovered_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    return fixed;
  }

  async autoFixQuarantined(index) {
    const quarantined = this.getQuarantinedTasks();
    if (index < 0 || index >= quarantined.length) return { restored: false };
    const entry = quarantined[index];
    const fixed = this.autoFix(entry.original);
    try {
      const candidate = new Task(fixed);
      const { isValid, errors } = candidate.validate();
      if (!isValid) return { restored: false, errors };
      const tasks = await this.getTasks();
      tasks.unshift(candidate);
      await this.saveTasks(tasks);
      quarantined.splice(index,1);
      localStorage.setItem(this.quarantineKey(), this.safeJson.stringify(quarantined, '[]'));
      return { restored: true, fixed: true };
    } catch (e) {
      return { restored: false, errors: [e.message] };
    }
  }

  async autoFixAllQuarantined(limit = 50) {
    const quarantined = this.getQuarantinedTasks();
    let restoredCount = 0;
    for (let i = 0; i < quarantined.length && restoredCount < limit; i++) {
      const fixed = this.autoFix(quarantined[i].original);
      try {
        const candidate = new Task(fixed);
        const { isValid } = candidate.validate();
        if (isValid) {
          // Add directly to existing list
          const tasks = await this.getTasks();
            tasks.unshift(candidate);
            await this.saveTasks(tasks);
            quarantined.splice(i,1);
            i--;
            restoredCount++;
        }
      } catch { /* continue */ }
    }
    localStorage.setItem(this.quarantineKey(), this.safeJson.stringify(quarantined, '[]'));
    return { restoredCount, remaining: quarantined.length };
  }
}