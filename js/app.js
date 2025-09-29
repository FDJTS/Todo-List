/**
 * Main Application Logic for Todo List App
 * Coordinates between storage, UI, and notifications
 */

class TodoApp {
    constructor() {
        console.log('TodoApp constructor started');
        this.tasks = [];
        this.settings = {};
        this.currentFilters = {
            search: '',
            status: 'all',
            priority: 'all'
        };
        this.currentSort = {
            by: 'created',
            direction: 'desc'
        };
        
        this.storageManager = null;
        this.uiManager = null;
        this.notificationManager = null;
        
        this.isInitialized = false;
        console.log('TodoApp constructor completed, calling init...');
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('TodoApp init started');
        try {
            // Initialize managers
            console.log('Creating StorageManager...');
            this.storageManager = new StorageManager();
            console.log('StorageManager created successfully');
            
            console.log('Creating UIManager...');
            this.uiManager = new UIManager();
            console.log('UIManager created successfully');
            
            console.log('Creating NotificationManager...');
            this.notificationManager = new NotificationManager();
            console.log('NotificationManager created successfully');

            // Load data
            console.log('Loading data...');
            await this.loadData();
            console.log('Data loaded successfully');

            // Bind events
            console.log('Binding events...');
            this.bindEvents();
            console.log('Events bound successfully');

            // Initial render
            console.log('Initial render...');
            this.render();
            console.log('Initial render completed');

            // Set up periodic tasks
            console.log('Setting up periodic tasks...');
            this.setupPeriodicTasks();
            console.log('Periodic tasks setup completed');

            this.isInitialized = true;
            console.log('Todo App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Load data from storage
     */
    async loadData() {
        try {
            // Load tasks and settings in parallel
            const [tasks, settings] = await Promise.all([
                this.storageManager.getTasks(),
                this.storageManager.getSettings()
            ]);

            this.tasks = tasks || [];
            this.settings = settings || this.storageManager.getDefaultSettings();

            // Apply settings
            this.applySettings();

            console.log(`Loaded ${this.tasks.length} tasks`);
        } catch (error) {
            console.error('Error loading data:', error);
            this.notificationManager.showError('Failed to load your tasks. Please refresh the page.');
        }
    }

    /**
     * Apply settings to the application
     */
    applySettings() {
        // Apply theme
        if (this.settings.theme) {
            this.uiManager.setTheme(this.settings.theme);
        }

        // Apply sort preferences
        if (this.settings.sortBy) {
            this.currentSort.by = this.settings.sortBy;
            this.currentSort.direction = this.settings.sortDirection || 'desc';
        }

        // Apply accessibility settings
        if (this.settings.accessibility) {
            this.applyAccessibilitySettings();
        }

        // Set up notifications if enabled
        if (this.settings.notificationsEnabled) {
            this.setupNotifications();
        }
    }

    /**
     * Apply accessibility settings
     */
    applyAccessibilitySettings() {
        const { accessibility } = this.settings;
        
        if (accessibility.colorblindMode) {
            document.documentElement.setAttribute('data-accessibility', 'colorblind');
        }

        if (accessibility.highContrast) {
            document.documentElement.setAttribute('data-theme', 'high-contrast');
        }

        if (accessibility.reducedMotion) {
            document.documentElement.style.setProperty('--transition-fast', '0ms');
            document.documentElement.style.setProperty('--transition-normal', '0ms');
            document.documentElement.style.setProperty('--transition-slow', '0ms');
        }

        if (this.settings.textSize && this.settings.textSize !== 'normal') {
            document.documentElement.setAttribute('data-text-size', this.settings.textSize);
        }
    }

    /**
     * Set up notifications
     */
    async setupNotifications() {
        try {
            await this.notificationManager.requestPermission();
            this.setupTaskReminders();
            this.notificationManager.setDailyReminder(9, 0); // 9:00 AM daily reminder
        } catch (error) {
            console.log('Notifications not available:', error.message);
            this.settings.notificationsEnabled = false;
            await this.storageManager.saveSettings(this.settings);
        }
    }

    /**
     * Set up task reminders
     */
    setupTaskReminders() {
        this.tasks.forEach(task => {
            if (task.dueDate && !task.completed) {
                // Set reminder for 1 hour before due date
                const reminderTime = new Date(task.dueDate.getTime() - 60 * 60 * 1000);
                if (reminderTime > new Date()) {
                    this.notificationManager.setTaskReminder(task, reminderTime);
                }
            }
        });
    }

    /**
     * Bind application events
     */
    bindEvents() {
        // Task events
        document.addEventListener('taskAdd', this.handleTaskAdd.bind(this));
        document.addEventListener('taskToggle', this.handleTaskToggle.bind(this));
        document.addEventListener('taskEdit', this.handleTaskEdit.bind(this));
        document.addEventListener('taskDelete', this.handleTaskDelete.bind(this));

        // Filter and sort events
        document.addEventListener('filtersChange', this.handleFiltersChange.bind(this));
        document.addEventListener('sortChange', this.handleSortChange.bind(this));

        // App events
        document.addEventListener('exportData', this.handleExportData.bind(this));
        document.addEventListener('importData', this.handleImportData.bind(this));
        document.addEventListener('clearCompleted', this.handleClearCompleted.bind(this));
        document.addEventListener('clearAllData', this.handleClearAllData.bind(this));

        // Settings events
        document.addEventListener('settingsChange', this.handleSettingsChange.bind(this));

        // Daily reminder event
        document.addEventListener('dailyReminder', this.handleDailyReminder.bind(this));

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleGlobalKeyboard.bind(this));

        // Online/offline events
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));

        // Before unload (save data)
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }

    /**
     * Handle adding a new task
     */
    async handleTaskAdd(event) {
        const { task } = event.detail;

        try {
            // Add to local array
            this.tasks.push(task);

            // Save to storage
            await this.storageManager.addTask(task);

            // Re-render
            this.render();

            // Show success message
            this.notificationManager.showSuccess(`Task "${task.title}" added successfully!`);

            // Set up reminder if due date is set
            if (task.dueDate && !task.completed) {
                const reminderTime = new Date(task.dueDate.getTime() - 60 * 60 * 1000);
                if (reminderTime > new Date()) {
                    this.notificationManager.setTaskReminder(task, reminderTime);
                }
            }

            // Track analytics (if implemented)
            this.trackEvent('task_added', { priority: task.priority, hasDueDate: !!task.dueDate });

        } catch (error) {
            console.error('Error adding task:', error);
            // Remove from local array on failure
            this.tasks = this.tasks.filter(t => t.id !== task.id);
            this.notificationManager.showError('Failed to add task. Please try again.');
        }
    }

    /**
     * Handle toggling task completion
     */
    async handleTaskToggle(event) {
        const { taskId, completed } = event.detail;

        try {
            // Find and update task
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) return;

            const previousState = task.completed;
            task.completed = completed;
            task.updatedAt = new Date();

            // Save to storage
            await this.storageManager.updateTask(task);

            // Re-render
            this.render();

            // Show appropriate message
            if (completed) {
                this.notificationManager.showTaskCompleted(task.title);
                // Clear any existing reminders
                this.notificationManager.clearTaskReminder(taskId);
            } else {
                // Set up reminder again if task has due date
                if (task.dueDate) {
                    const reminderTime = new Date(task.dueDate.getTime() - 60 * 60 * 1000);
                    if (reminderTime > new Date()) {
                        this.notificationManager.setTaskReminder(task, reminderTime);
                    }
                }
            }

            // Track analytics
            this.trackEvent('task_toggled', { 
                completed, 
                priority: task.priority,
                wasOverdue: Utils.isOverdue(task.dueDate)
            });

        } catch (error) {
            console.error('Error toggling task:', error);
            // Revert change on failure
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.completed = !completed;
            }
            this.render();
            this.notificationManager.showError('Failed to update task. Please try again.');
        }
    }

    /**
     * Handle editing a task
     */
    async handleTaskEdit(event) {
        const { taskId, updates } = event.detail;

        try {
            // Find and update task
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) return;

            const oldDueDate = task.dueDate;
            
            // Apply updates
            Object.assign(task, updates);
            task.updatedAt = new Date();

            // Save to storage
            await this.storageManager.updateTask(task);

            // Re-render
            this.render();

            // Update reminders if due date changed
            if (oldDueDate !== task.dueDate) {
                this.notificationManager.clearTaskReminder(taskId);
                if (task.dueDate && !task.completed) {
                    const reminderTime = new Date(task.dueDate.getTime() - 60 * 60 * 1000);
                    if (reminderTime > new Date()) {
                        this.notificationManager.setTaskReminder(task, reminderTime);
                    }
                }
            }

            this.notificationManager.showSuccess(`Task "${task.title}" updated successfully!`);

            // Track analytics
            this.trackEvent('task_edited', { priority: task.priority });

        } catch (error) {
            console.error('Error editing task:', error);
            this.notificationManager.showError('Failed to update task. Please try again.');
        }
    }

    /**
     * Handle deleting a task
     */
    async handleTaskDelete(event) {
        const { taskId } = event.detail;

        try {
            // Find task for title
            const task = this.tasks.find(t => t.id === taskId);
            const taskTitle = task ? task.title : 'Task';

            // Remove from local array
            this.tasks = this.tasks.filter(t => t.id !== taskId);

            // Remove from storage
            await this.storageManager.deleteTask(taskId);

            // Clear any reminders
            this.notificationManager.clearTaskReminder(taskId);

            // Re-render
            this.render();

            this.notificationManager.showSuccess(`"${taskTitle}" deleted successfully!`);

            // Track analytics
            this.trackEvent('task_deleted');

        } catch (error) {
            console.error('Error deleting task:', error);
            // Re-add task on failure (if we had it)
            if (task) {
                this.tasks.push(task);
                this.render();
            }
            this.notificationManager.showError('Failed to delete task. Please try again.');
        }
    }

    /**
     * Handle filter changes
     */
    handleFiltersChange(event) {
        this.currentFilters = { ...event.detail.filters };
        this.render();

        // Track analytics
        this.trackEvent('filters_changed', this.currentFilters);
    }

    /**
     * Handle sort changes
     */
    handleSortChange(event) {
        const { sortBy, direction } = event.detail;
        this.currentSort = { by: sortBy, direction };
        
        // Save sort preference
        this.settings.sortBy = sortBy;
        this.settings.sortDirection = direction;
        this.storageManager.saveSettings(this.settings);

        this.render();

        // Track analytics
        this.trackEvent('sort_changed', { sortBy, direction });
    }

    /**
     * Handle data export
     */
    async handleExportData() {
        try {
            const data = await this.storageManager.exportData();
            const filename = `todo-list-backup-${new Date().toISOString().split('T')[0]}.json`;
            
            Utils.downloadData(JSON.stringify(data, null, 2), filename, 'application/json');
            
            this.notificationManager.showSuccess('Data exported successfully!');
            
            // Track analytics
            this.trackEvent('data_exported', { taskCount: this.tasks.length });

        } catch (error) {
            console.error('Error exporting data:', error);
            this.notificationManager.showError('Failed to export data. Please try again.');
        }
    }

    /**
     * Handle data import
     */
    async handleImportData(event) {
        const { file } = event.detail;

        try {
            const text = await this.readFile(file);
            const data = JSON.parse(text);

            // Validate data structure
            if (!this.validateImportData(data)) {
                throw new Error('Invalid file format');
            }

            // Backup current data first
            const backup = await this.storageManager.exportData();
            
            // Import new data
            const success = await this.storageManager.importData(data);
            
            if (success) {
                // Reload application data
                await this.loadData();
                this.render();
                
                this.notificationManager.showSuccess(`Successfully imported ${data.tasks?.length || 0} tasks!`);
                
                // Track analytics
                this.trackEvent('data_imported', { 
                    taskCount: data.tasks?.length || 0,
                    hasSettings: !!data.settings
                });
            } else {
                throw new Error('Import failed');
            }

        } catch (error) {
            console.error('Error importing data:', error);
            this.notificationManager.showError('Failed to import data. Please check the file format.');
        }
    }

    /**
     * Read file as text
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Validate import data structure
     */
    validateImportData(data) {
        if (!data || typeof data !== 'object') return false;
        if (data.tasks && !Array.isArray(data.tasks)) return false;
        if (data.settings && typeof data.settings !== 'object') return false;
        
        // Validate task structure
        if (data.tasks) {
            for (const task of data.tasks) {
                if (!task.id || !task.title || typeof task.completed !== 'boolean') {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Handle clearing completed tasks
     */
    async handleClearCompleted() {
        try {
            const completedTasks = this.tasks.filter(t => t.completed);
            
            if (completedTasks.length === 0) {
                this.notificationManager.showInfo('No completed tasks to clear.');
                return;
            }

            // Remove completed tasks
            this.tasks = this.tasks.filter(t => !t.completed);

            // Save to storage
            await this.storageManager.saveTasks(this.tasks);

            // Re-render
            this.render();

            this.notificationManager.showSuccess(`Cleared ${completedTasks.length} completed task${completedTasks.length === 1 ? '' : 's'}!`);

            // Track analytics
            this.trackEvent('completed_tasks_cleared', { count: completedTasks.length });

        } catch (error) {
            console.error('Error clearing completed tasks:', error);
            this.notificationManager.showError('Failed to clear completed tasks. Please try again.');
        }
    }

    /**
     * Handle clearing all data
     */
    async handleClearAllData() {
        if (!confirm('Are you sure you want to delete all tasks and settings? This action cannot be undone.')) {
            return;
        }

        try {
            // Clear all data
            await this.storageManager.clearAllData();

            // Reset application state
            this.tasks = [];
            this.settings = this.storageManager.getDefaultSettings();

            // Clear all reminders
            this.notificationManager.clearAllReminders();

            // Re-render
            this.render();

            this.notificationManager.showSuccess('All data cleared successfully!');

            // Track analytics
            this.trackEvent('all_data_cleared');

        } catch (error) {
            console.error('Error clearing all data:', error);
            this.notificationManager.showError('Failed to clear data. Please try again.');
        }
    }

    /**
     * Handle settings changes
     */
    async handleSettingsChange(event) {
        const { settings } = event.detail;

        try {
            // Update local settings
            this.settings = { ...this.settings, ...settings };

            // Save to storage
            await this.storageManager.saveSettings(this.settings);

            // Apply settings
            this.applySettings();

            this.notificationManager.showSuccess('Settings saved successfully!');

            // Track analytics
            this.trackEvent('settings_changed', Object.keys(settings));

        } catch (error) {
            console.error('Error saving settings:', error);
            this.notificationManager.showError('Failed to save settings. Please try again.');
        }
    }

    /**
     * Handle daily reminder
     */
    handleDailyReminder() {
        const pendingTasks = this.tasks.filter(t => !t.completed);
        const overdueTasks = pendingTasks.filter(t => t.dueDate && Utils.isOverdue(t.dueDate));

        let message = `You have ${pendingTasks.length} pending task${pendingTasks.length === 1 ? '' : 's'}`;
        
        if (overdueTasks.length > 0) {
            message += ` (${overdueTasks.length} overdue)`;
        }

        if (this.settings.notificationsEnabled && this.notificationManager.permission === 'granted') {
            this.notificationManager.showNotification('Daily Task Reminder', {
                body: message,
                requireInteraction: true
            });
        }

        this.notificationManager.showInfo(message, 'Daily Reminder');
    }

    /**
     * Handle global keyboard shortcuts
     */
    handleGlobalKeyboard(event) {
        // Ctrl/Cmd + S: Save (prevent default and show message)
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.notificationManager.showInfo('All changes are automatically saved!');
        }

        // Ctrl/Cmd + A: Select all tasks (when not in input)
        if ((event.ctrlKey || event.metaKey) && event.key === 'a' && 
            !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
            event.preventDefault();
            // Could implement bulk task selection here
        }
    }

    /**
     * Handle online event
     */
    handleOnline() {
        this.notificationManager.showSuccess('Connection restored!', 'Back Online');
        // Could implement data sync here if cloud storage was available
    }

    /**
     * Handle offline event
     */
    handleOffline() {
        this.notificationManager.showWarning('Working offline. Changes will be saved locally.', 'No Internet Connection');
    }

    /**
     * Handle before unload
     */
    handleBeforeUnload(event) {
        // Ensure all data is saved
        // This is mainly for cleanup as our storage is async
        if (this.tasks.length > 0) {
            this.storageManager.saveTasks(this.tasks);
        }
    }

    /**
     * Render the application
     */
    render() {
        if (!this.isInitialized) return;

        // Filter and sort tasks
        const filteredTasks = Utils.filterTasks(this.tasks, this.currentFilters);
        const sortedTasks = Utils.sortTasks(filteredTasks, this.currentSort.by, this.currentSort.direction);

        // Render tasks
        this.uiManager.renderTasks(sortedTasks);

        // Update statistics
        const stats = Utils.calculateStats(this.tasks);
        this.uiManager.updateStats(stats);

        // Update document title with task count
        const pendingCount = stats.pending;
        document.title = pendingCount > 0 ? 
            `(${pendingCount}) Todo List App` : 
            'Todo List App';
    }

    /**
     * Set up periodic tasks
     */
    setupPeriodicTasks() {
        // Auto-save every 30 seconds (as a backup)
        setInterval(async () => {
            try {
                await this.storageManager.saveTasks(this.tasks);
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        }, 30000);

        // Check for overdue tasks every hour
        setInterval(() => {
            this.checkOverdueTasks();
        }, 3600000);
    }

    /**
     * Check for overdue tasks and notify
     */
    checkOverdueTasks() {
        if (!this.settings.autoMarkOverdue) return;

        const overdueTasks = this.tasks.filter(task => 
            !task.completed && task.dueDate && Utils.isOverdue(task.dueDate)
        );

        if (overdueTasks.length > 0) {
            this.notificationManager.showWarning(
                `You have ${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`,
                'Overdue Tasks'
            );
        }
    }

    /**
     * Handle initialization error
     */
    handleInitializationError(error) {
        // Show error in UI
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; background: #f3f4f6; color: #374151;">
                <div style="text-align: center; max-width: 400px; padding: 2rem;">
                    <h1 style="color: #ef4444; margin-bottom: 1rem;">App Failed to Load</h1>
                    <p style="margin-bottom: 1rem;">There was an error loading the Todo List app. This might be due to:</p>
                    <ul style="text-align: left; margin-bottom: 1rem;">
                        <li>Browser storage limitations</li>
                        <li>Corrupted data</li>
                        <li>Browser compatibility issues</li>
                    </ul>
                    <button onclick="window.location.reload()" style="background: #2563eb; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">
                        Reload Page
                    </button>
                    <br><br>
                    <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload()" style="background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">
                        Clear All Data & Reload
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Track analytics event
     */
    trackEvent(eventName, eventData = {}) {
        // Simple analytics tracking - could be enhanced with services like Google Analytics
        console.log(`Analytics: ${eventName}`, eventData);
        
        // Could send to analytics service here
        // gtag('event', eventName, eventData);
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            taskCount: this.tasks.length,
            completedCount: this.tasks.filter(t => t.completed).length,
            overdueCount: this.tasks.filter(t => !t.completed && t.dueDate && Utils.isOverdue(t.dueDate)).length,
            storageType: this.storageManager?.db ? 'IndexedDB' : 'localStorage',
            notificationsEnabled: this.settings.notificationsEnabled,
            currentFilters: this.currentFilters,
            currentSort: this.currentSort
        };
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired, creating TodoApp...');
    try {
        window.todoApp = new TodoApp();
        console.log('TodoApp created successfully');
    } catch (error) {
        console.error('Error creating TodoApp:', error);
    }
});

// Export for global access
if (typeof window !== 'undefined') {
    window.TodoApp = TodoApp;
}