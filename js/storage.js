// Storage Manager for Local Storage and IndexedDB
class StorageManager {
  constructor() {
    this.dbName = 'TodoPWA';
    this.dbVersion = 1;
    this.db = null;
    this.fallbackToLocalStorage = false;
    
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
        const tasks = request.result.map(taskData => Task.fromJSON(taskData));
        resolve(tasks);
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
    try {
      const tasksData = localStorage.getItem('todo-pwa-tasks');
      if (!tasksData) return [];
      
      const parsed = JSON.parse(tasksData);
      return parsed.map(taskData => Task.fromJSON(taskData));
    } catch (error) {
      console.error('Error loading tasks from localStorage:', error);
      return [];
    }
  }

  saveTasksToLocalStorage(tasks) {
    try {
      const tasksData = tasks.map(task => task.toJSON ? task.toJSON() : task);
      localStorage.setItem('todo-pwa-tasks', JSON.stringify(tasksData));
      return true;
    } catch (error) {
      console.error('Error saving tasks to localStorage:', error);
      return false;
    }
  }

  async getSetting(key, defaultValue = null) {
    if (this.fallbackToLocalStorage) {
      try {
        const value = localStorage.getItem(`todo-pwa-setting-${key}`);
        return value !== null ? JSON.parse(value) : defaultValue;
      } catch {
        return defaultValue;
      }
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
      try {
        localStorage.setItem(`todo-pwa-setting-${key}`, JSON.stringify(value));
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
      try {
        const history = JSON.parse(localStorage.getItem('todo-pwa-history') || '[]');
        history.push(historyEntry);
        
        // Keep only last 100 entries
        if (history.length > 100) {
          history.splice(0, history.length - 100);
        }
        
        localStorage.setItem('todo-pwa-history', JSON.stringify(history));
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
      try {
        return JSON.parse(localStorage.getItem('todo-pwa-history') || '[]');
      } catch {
        return [];
      }
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
}