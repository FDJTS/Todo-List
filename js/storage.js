/**
 * Storage Manager for Todo List App
 * Handles data persistence with fallbacks and error handling
 */

class StorageManager {
    constructor() {
        this.storageKey = 'todoListApp';
        this.settingsKey = 'todoListSettings';
        this.isIndexedDBSupported = this.checkIndexedDBSupport();
        this.isLocalStorageSupported = this.checkLocalStorageSupport();
        this.db = null;
        this.initializeDatabase();
    }

    /**
     * Check if IndexedDB is supported
     * @returns {boolean} True if supported
     */
    checkIndexedDBSupport() {
        return 'indexedDB' in window && typeof indexedDB !== 'undefined';
    }

    /**
     * Check if localStorage is supported
     * @returns {boolean} True if supported
     */
    checkLocalStorageSupported() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Initialize IndexedDB database
     */
    async initializeDatabase() {
        if (!this.isIndexedDBSupported) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TodoListDB', 1);

            request.onerror = () => {
                console.warn('IndexedDB not available, falling back to localStorage');
                resolve();
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create tasks store
                if (!db.objectStoreNames.contains('tasks')) {
                    const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    tasksStore.createIndex('completed', 'completed', { unique: false });
                    tasksStore.createIndex('priority', 'priority', { unique: false });
                    tasksStore.createIndex('dueDate', 'dueDate', { unique: false });
                    tasksStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Create settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Get all tasks from storage
     * @returns {Promise<Array>} Array of tasks
     */
    async getTasks() {
        try {
            if (this.db) {
                return await this.getTasksFromIndexedDB();
            } else if (this.isLocalStorageSupported) {
                return this.getTasksFromLocalStorage();
            } else {
                console.warn('No storage available');
                return [];
            }
        } catch (error) {
            console.error('Error getting tasks:', error);
            return [];
        }
    }

    /**
     * Get tasks from IndexedDB
     * @returns {Promise<Array>} Array of tasks
     */
    async getTasksFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readonly');
            const store = transaction.objectStore('tasks');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get tasks from localStorage
     * @returns {Array} Array of tasks
     */
    getTasksFromLocalStorage() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error parsing tasks from localStorage:', error);
            return [];
        }
    }

    /**
     * Save tasks to storage
     * @param {Array} tasks - Array of tasks to save
     * @returns {Promise<boolean>} True if successful
     */
    async saveTasks(tasks) {
        try {
            if (this.db) {
                return await this.saveTasksToIndexedDB(tasks);
            } else if (this.isLocalStorageSupported) {
                return this.saveTasksToLocalStorage(tasks);
            } else {
                console.warn('No storage available');
                return false;
            }
        } catch (error) {
            console.error('Error saving tasks:', error);
            return false;
        }
    }

    /**
     * Save tasks to IndexedDB
     * @param {Array} tasks - Array of tasks to save
     * @returns {Promise<boolean>} True if successful
     */
    async saveTasksToIndexedDB(tasks) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');

            // Clear existing tasks
            const clearRequest = store.clear();
            
            clearRequest.onsuccess = () => {
                // Add all tasks
                let completed = 0;
                const total = tasks.length;

                if (total === 0) {
                    resolve(true);
                    return;
                }

                tasks.forEach(task => {
                    const addRequest = store.add(task);
                    addRequest.onsuccess = () => {
                        completed++;
                        if (completed === total) {
                            resolve(true);
                        }
                    };
                    addRequest.onerror = () => {
                        reject(addRequest.error);
                    };
                });
            };

            clearRequest.onerror = () => {
                reject(clearRequest.error);
            };
        });
    }

    /**
     * Save tasks to localStorage
     * @param {Array} tasks - Array of tasks to save
     * @returns {boolean} True if successful
     */
    saveTasksToLocalStorage(tasks) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(tasks));
            return true;
        } catch (error) {
            console.error('Error saving tasks to localStorage:', error);
            return false;
        }
    }

    /**
     * Add a single task
     * @param {Object} task - Task to add
     * @returns {Promise<boolean>} True if successful
     */
    async addTask(task) {
        try {
            if (this.db) {
                return await this.addTaskToIndexedDB(task);
            } else {
                const tasks = await this.getTasks();
                tasks.push(task);
                return await this.saveTasks(tasks);
            }
        } catch (error) {
            console.error('Error adding task:', error);
            return false;
        }
    }

    /**
     * Add task to IndexedDB
     * @param {Object} task - Task to add
     * @returns {Promise<boolean>} True if successful
     */
    async addTaskToIndexedDB(task) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const request = store.add(task);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Update a task
     * @param {Object} task - Updated task
     * @returns {Promise<boolean>} True if successful
     */
    async updateTask(task) {
        try {
            if (this.db) {
                return await this.updateTaskInIndexedDB(task);
            } else {
                const tasks = await this.getTasks();
                const index = tasks.findIndex(t => t.id === task.id);
                if (index !== -1) {
                    tasks[index] = task;
                    return await this.saveTasks(tasks);
                }
                return false;
            }
        } catch (error) {
            console.error('Error updating task:', error);
            return false;
        }
    }

    /**
     * Update task in IndexedDB
     * @param {Object} task - Task to update
     * @returns {Promise<boolean>} True if successful
     */
    async updateTaskInIndexedDB(task) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const request = store.put(task);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Delete a task
     * @param {string} taskId - ID of task to delete
     * @returns {Promise<boolean>} True if successful
     */
    async deleteTask(taskId) {
        try {
            if (this.db) {
                return await this.deleteTaskFromIndexedDB(taskId);
            } else {
                const tasks = await this.getTasks();
                const filteredTasks = tasks.filter(t => t.id !== taskId);
                return await this.saveTasks(filteredTasks);
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            return false;
        }
    }

    /**
     * Delete task from IndexedDB
     * @param {string} taskId - ID of task to delete
     * @returns {Promise<boolean>} True if successful
     */
    async deleteTaskFromIndexedDB(taskId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks'], 'readwrite');
            const store = transaction.objectStore('tasks');
            const request = store.delete(taskId);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get settings from storage
     * @returns {Promise<Object>} Settings object
     */
    async getSettings() {
        try {
            if (this.db) {
                return await this.getSettingsFromIndexedDB();
            } else if (this.isLocalStorageSupported) {
                return this.getSettingsFromLocalStorage();
            } else {
                return this.getDefaultSettings();
            }
        } catch (error) {
            console.error('Error getting settings:', error);
            return this.getDefaultSettings();
        }
    }

    /**
     * Get settings from IndexedDB
     * @returns {Promise<Object>} Settings object
     */
    async getSettingsFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get('userSettings');

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : this.getDefaultSettings());
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get settings from localStorage
     * @returns {Object} Settings object
     */
    getSettingsFromLocalStorage() {
        try {
            const data = localStorage.getItem(this.settingsKey);
            return data ? JSON.parse(data) : this.getDefaultSettings();
        } catch (error) {
            console.error('Error parsing settings from localStorage:', error);
            return this.getDefaultSettings();
        }
    }

    /**
     * Get default settings
     * @returns {Object} Default settings
     */
    getDefaultSettings() {
        return {
            theme: 'auto',
            colorTheme: 'blue',
            textSize: 'normal',
            notificationsEnabled: false,
            sortBy: 'created',
            sortDirection: 'desc',
            defaultPriority: 'medium',
            autoMarkOverdue: true,
            showCompletedTasks: true,
            accessibility: {
                colorblindMode: false,
                highContrast: false,
                reducedMotion: false
            }
        };
    }

    /**
     * Save settings to storage
     * @param {Object} settings - Settings to save
     * @returns {Promise<boolean>} True if successful
     */
    async saveSettings(settings) {
        try {
            if (this.db) {
                return await this.saveSettingsToIndexedDB(settings);
            } else if (this.isLocalStorageSupported) {
                return this.saveSettingsToLocalStorage(settings);
            } else {
                console.warn('No storage available for settings');
                return false;
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    /**
     * Save settings to IndexedDB
     * @param {Object} settings - Settings to save
     * @returns {Promise<boolean>} True if successful
     */
    async saveSettingsToIndexedDB(settings) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key: 'userSettings', value: settings });

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Save settings to localStorage
     * @param {Object} settings - Settings to save
     * @returns {boolean} True if successful
     */
    saveSettingsToLocalStorage(settings) {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Error saving settings to localStorage:', error);
            return false;
        }
    }

    /**
     * Export all data
     * @returns {Promise<Object>} Exported data
     */
    async exportData() {
        try {
            const [tasks, settings] = await Promise.all([
                this.getTasks(),
                this.getSettings()
            ]);

            return {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                tasks,
                settings
            };
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    /**
     * Import data
     * @param {Object} data - Data to import
     * @returns {Promise<boolean>} True if successful
     */
    async importData(data) {
        try {
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid data format');
            }

            if (data.tasks && Array.isArray(data.tasks)) {
                await this.saveTasks(data.tasks);
            }

            if (data.settings && typeof data.settings === 'object') {
                await this.saveSettings(data.settings);
            }

            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    /**
     * Clear all data
     * @returns {Promise<boolean>} True if successful
     */
    async clearAllData() {
        try {
            if (this.db) {
                await this.clearIndexedDB();
            }
            
            if (this.isLocalStorageSupported) {
                localStorage.removeItem(this.storageKey);
                localStorage.removeItem(this.settingsKey);
            }

            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }

    /**
     * Clear IndexedDB data
     * @returns {Promise<boolean>} True if successful
     */
    async clearIndexedDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tasks', 'settings'], 'readwrite');
            
            const tasksStore = transaction.objectStore('tasks');
            const settingsStore = transaction.objectStore('settings');
            
            const clearTasks = tasksStore.clear();
            const clearSettings = settingsStore.clear();
            
            let completed = 0;
            const checkCompletion = () => {
                completed++;
                if (completed === 2) {
                    resolve(true);
                }
            };

            clearTasks.onsuccess = checkCompletion;
            clearSettings.onsuccess = checkCompletion;

            clearTasks.onerror = () => reject(clearTasks.error);
            clearSettings.onerror = () => reject(clearSettings.error);
        });
    }

    /**
     * Get storage usage information
     * @returns {Promise<Object>} Storage usage info
     */
    async getStorageInfo() {
        try {
            const tasks = await this.getTasks();
            const settings = await this.getSettings();
            
            const tasksSize = new Blob([JSON.stringify(tasks)]).size;
            const settingsSize = new Blob([JSON.stringify(settings)]).size;
            const totalSize = tasksSize + settingsSize;

            return {
                tasksCount: tasks.length,
                tasksSize: Utils.formatFileSize(tasksSize),
                settingsSize: Utils.formatFileSize(settingsSize),
                totalSize: Utils.formatFileSize(totalSize),
                storageType: this.db ? 'IndexedDB' : 'localStorage',
                isIndexedDBSupported: this.isIndexedDBSupported,
                isLocalStorageSupported: this.isLocalStorageSupported
            };
        } catch (error) {
            console.error('Error getting storage info:', error);
            return null;
        }
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
}