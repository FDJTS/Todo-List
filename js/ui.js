/**
 * UI Manager for Todo List App
 * Handles DOM manipulation, event binding, and user interactions
 */

class UIManager {
    constructor() {
        console.log('UIManager constructor started');
        this.elements = {};
        this.currentTheme = 'auto';
        this.currentSort = 'created';
        this.currentSortDirection = 'desc';
        this.currentFilters = {
            search: '',
            status: 'all',
            priority: 'all'
        };
        
        console.log('UIManager constructor completed, calling init...');
        this.init();
    }

    /**
     * Initialize UI Manager
     */
    init() {
        console.log('UIManager init started');
        try {
            this.cacheElements();
            console.log('Elements cached successfully');
            this.bindEvents();
            console.log('Events bound successfully');
            this.setupTheme();
            console.log('Theme setup successful');
            this.setupAccessibility();
            console.log('Accessibility setup successful');
            console.log('UIManager initialization completed');
        } catch (error) {
            console.error('Error in UIManager init:', error);
            throw error;
        }
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        // Add defensive checks for DOM readiness
        if (!document.getElementById('app')) {
            console.warn('Main app element not found, DOM might not be ready');
            return;
        }
        
        this.elements = {
            // Forms and inputs
            addTaskForm: document.getElementById('add-task-form'),
            taskInput: document.getElementById('task-input'),
            taskTags: document.getElementById('task-tags'),
            taskPriority: document.getElementById('task-priority'),
            taskDueDate: document.getElementById('task-due-date'),
            
            // Filters and search
            searchInput: document.getElementById('search-input'),
            statusFilter: document.getElementById('status-filter'),
            priorityFilter: document.getElementById('priority-filter'),
            sortSelect: document.getElementById('sort-select'),
            
            // Task container and states
            tasksContainer: document.getElementById('tasks-container'),
            emptyState: document.getElementById('empty-state'),
            loadingState: document.getElementById('loading-state'),
            
            // Stats
            totalTasks: document.getElementById('total-tasks'),
            pendingTasks: document.getElementById('pending-tasks'),
            completedTasks: document.getElementById('completed-tasks'),
            completionRate: document.getElementById('completion-rate'),
            
            // Controls
            themeToggle: document.getElementById('theme-toggle'),
            settingsBtn: document.getElementById('settings-btn'),
            exportBtn: document.getElementById('export-btn'),
            importBtn: document.getElementById('import-btn'),
            clearCompletedBtn: document.getElementById('clear-completed-btn'),
            
            // Modals
            settingsModal: document.getElementById('settings-modal'),
            taskModal: document.getElementById('task-modal'),
            editTaskForm: document.getElementById('edit-task-form'),
            
            // Import
            importFileInput: document.getElementById('import-file-input')
        };
        
        // Log what we found for debugging
        const foundElements = Object.keys(this.elements).filter(key => this.elements[key] !== null);
        console.log(`Found ${foundElements.length}/${Object.keys(this.elements).length} DOM elements`);
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Add task form
        if (this.elements.addTaskForm) {
            this.elements.addTaskForm.addEventListener('submit', this.handleAddTask.bind(this));
        }

        // Search and filters
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', 
                Utils.debounce(this.handleSearch.bind(this), 300));
        }

        if (this.elements.statusFilter) {
            this.elements.statusFilter.addEventListener('change', this.handleFilterChange.bind(this));
        }

        if (this.elements.priorityFilter) {
            this.elements.priorityFilter.addEventListener('change', this.handleFilterChange.bind(this));
        }

        if (this.elements.sortSelect) {
            this.elements.sortSelect.addEventListener('change', this.handleSortChange.bind(this));
        }

        // Theme toggle
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', this.handleThemeToggle.bind(this));
        }

        // Settings
        if (this.elements.settingsBtn) {
            try {
                console.log('Binding settings button, method exists:', typeof this.openSettingsModal);
                this.elements.settingsBtn.addEventListener('click', this.openSettingsModal.bind(this));
            } catch (error) {
                console.error('Error binding settings button:', error);
            }
        }

        // Export/Import
        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener('click', this.handleExport.bind(this));
        }

        if (this.elements.importBtn) {
            this.elements.importBtn.addEventListener('click', this.handleImport.bind(this));
        }

        if (this.elements.importFileInput) {
            this.elements.importFileInput.addEventListener('change', this.handleFileImport.bind(this));
        }

        if (this.elements.clearCompletedBtn) {
            this.elements.clearCompletedBtn.addEventListener('click', this.handleClearCompleted.bind(this));
        }

        // Modal events
        this.bindModalEvents();

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

        // Task container events (delegated)
        if (this.elements.tasksContainer) {
            this.elements.tasksContainer.addEventListener('click', this.handleTaskAction.bind(this));
            this.elements.tasksContainer.addEventListener('change', this.handleTaskCheckbox.bind(this));
        }
    }

    /**
     * Bind modal events
     */
    bindModalEvents() {
        // Settings modal
        const settingsModal = this.elements.settingsModal;
        if (settingsModal) {
            const closeBtn = settingsModal.querySelector('.modal-close');
            const overlay = settingsModal.querySelector('.modal-overlay');
            
            if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal(settingsModal));
            if (overlay) overlay.addEventListener('click', () => this.closeModal(settingsModal));

            // Settings form elements
            const notificationsToggle = document.getElementById('notifications-enabled');
            if (notificationsToggle) {
                notificationsToggle.addEventListener('change', this.handleNotificationToggle.bind(this));
            }

            const clearDataBtn = document.getElementById('clear-all-data-btn');
            if (clearDataBtn) {
                clearDataBtn.addEventListener('click', this.handleClearAllData.bind(this));
            }
        }

        // Task edit modal
        const taskModal = this.elements.taskModal;
        if (taskModal) {
            const closeBtn = taskModal.querySelector('.modal-close');
            const overlay = taskModal.querySelector('.modal-overlay');
            const cancelBtn = taskModal.querySelector('.cancel-btn');
            
            if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal(taskModal));
            if (overlay) overlay.addEventListener('click', () => this.closeModal(taskModal));
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal(taskModal));

            if (this.elements.editTaskForm) {
                this.elements.editTaskForm.addEventListener('submit', this.handleEditTask.bind(this));
            }
        }

        // Close modals on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    /**
     * Setup theme system
     */
    setupTheme() {
        // Check for saved theme or system preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else {
            // Auto-detect system theme
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.currentTheme === 'auto') {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    /**
     * Setup accessibility features
     */
    setupAccessibility() {
        // Add skip link
        const skipLink = document.createElement('a');
        skipLink.href = '#main';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'Skip to main content';
        document.body.insertBefore(skipLink, document.body.firstChild);

        // Set up focus management
        this.setupFocusManagement();

        // Add ARIA labels and descriptions where needed
        this.enhanceAccessibility();
    }

    /**
     * Setup focus management
     */
    setupFocusManagement() {
        // Trap focus in modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const activeModal = document.querySelector('.modal:not(.hidden)');
                if (activeModal) {
                    this.trapFocus(e, activeModal);
                }
            }
        });
    }

    /**
     * Trap focus within an element
     */
    trapFocus(e, element) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                lastFocusable.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                firstFocusable.focus();
                e.preventDefault();
            }
        }
    }

    /**
     * Enhance accessibility
     */
    enhanceAccessibility() {
        // Add proper ARIA labels to form inputs
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
                input.setAttribute('aria-labelledby', label.id || `label-${input.id}`);
                if (!label.id) label.id = `label-${input.id}`;
            }
        });

        // Add ARIA live regions for dynamic content
        if (this.elements.tasksContainer) {
            this.elements.tasksContainer.setAttribute('aria-live', 'polite');
        }
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Update theme toggle icon
        const lightIcon = this.elements.themeToggle?.querySelector('.theme-icon-light');
        const darkIcon = this.elements.themeToggle?.querySelector('.theme-icon-dark');
        
        if (theme === 'dark') {
            if (lightIcon) lightIcon.style.display = 'none';
            if (darkIcon) darkIcon.style.display = 'block';
        } else {
            if (lightIcon) lightIcon.style.display = 'block';
            if (darkIcon) darkIcon.style.display = 'none';
        }
    }

    /**
     * Handle theme toggle
     */
    handleThemeToggle() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    /**
     * Handle add task form submission
     */
    handleAddTask(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const title = this.elements.taskInput.value.trim();
        const tags = Utils.parseTags(this.elements.taskTags.value);
        const priority = this.elements.taskPriority.value;
        const dueDate = this.elements.taskDueDate.value;

        if (!title) {
            this.showFieldError(this.elements.taskInput, 'Title is required');
            return;
        }

        const task = {
            id: Utils.generateId(),
            title: Utils.sanitizeHTML(title),
            description: '',
            tags,
            priority,
            dueDate: dueDate ? new Date(dueDate) : null,
            completed: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Validate task
        const validation = Utils.validateTask(task);
        if (!validation.isValid) {
            this.showValidationErrors(validation.errors);
            return;
        }

        // Dispatch event for app to handle
        const event = new CustomEvent('taskAdd', { detail: { task } });
        document.dispatchEvent(event);

        // Reset form
        this.resetAddTaskForm();
    }

    /**
     * Reset add task form
     */
    resetAddTaskForm() {
        if (this.elements.addTaskForm) {
            this.elements.addTaskForm.reset();
            this.elements.taskInput.focus();
        }
        this.clearFieldErrors();
    }

    /**
     * Handle search input
     */
    handleSearch(e) {
        this.currentFilters.search = e.target.value;
        this.dispatchFilterChange();
    }

    /**
     * Handle filter changes
     */
    handleFilterChange(e) {
        if (e.target === this.elements.statusFilter) {
            this.currentFilters.status = e.target.value;
        } else if (e.target === this.elements.priorityFilter) {
            this.currentFilters.priority = e.target.value;
        }
        this.dispatchFilterChange();
    }

    /**
     * Handle sort changes
     */
    handleSortChange(e) {
        this.currentSort = e.target.value;
        this.dispatchSortChange();
    }

    /**
     * Dispatch filter change event
     */
    dispatchFilterChange() {
        const event = new CustomEvent('filtersChange', { 
            detail: { filters: this.currentFilters } 
        });
        document.dispatchEvent(event);
    }

    /**
     * Dispatch sort change event
     */
    dispatchSortChange() {
        const event = new CustomEvent('sortChange', { 
            detail: { 
                sortBy: this.currentSort, 
                direction: this.currentSortDirection 
            } 
        });
        document.dispatchEvent(event);
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + N: New task (focus input)
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            this.elements.taskInput?.focus();
        }

        // Ctrl/Cmd + F: Focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            this.elements.searchInput?.focus();
        }

        // Escape: Clear search
        if (e.key === 'Escape' && e.target === this.elements.searchInput) {
            this.elements.searchInput.value = '';
            this.handleSearch({ target: this.elements.searchInput });
        }
    }

    /**
     * Handle task actions (edit, delete, etc.)
     */
    handleTaskAction(e) {
        const action = e.target.dataset.action;
        const taskElement = e.target.closest('.task-item');
        const taskId = taskElement?.dataset.taskId;

        if (!action || !taskId) return;

        switch (action) {
            case 'edit':
                this.openEditTaskModal(taskId);
                break;
            case 'delete':
                this.confirmDeleteTask(taskId);
                break;
            default:
                break;
        }
    }

    /**
     * Handle task checkbox changes
     */
    handleTaskCheckbox(e) {
        if (e.target.classList.contains('task-checkbox-input')) {
            const taskElement = e.target.closest('.task-item');
            const taskId = taskElement?.dataset.taskId;
            const completed = e.target.checked;

            if (taskId) {
                const event = new CustomEvent('taskToggle', { 
                    detail: { taskId, completed } 
                });
                document.dispatchEvent(event);
            }
        }
    }

    /**
     * Render tasks
     */
    renderTasks(tasks) {
        if (!this.elements.tasksContainer) return;

        // Show loading state
        this.showLoadingState();

        // Use setTimeout to prevent blocking
        setTimeout(() => {
            if (tasks.length === 0) {
                this.showEmptyState();
                return;
            }

            this.hideStates();
            this.elements.tasksContainer.innerHTML = '';

            // Create document fragment for better performance
            const fragment = document.createDocumentFragment();

            tasks.forEach(task => {
                const taskElement = this.createTaskElement(task);
                fragment.appendChild(taskElement);
            });

            this.elements.tasksContainer.appendChild(fragment);

            // Announce change to screen readers
            this.announceTasksUpdate(tasks.length);
        }, 100);
    }

    /**
     * Create task element
     */
    createTaskElement(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-item ${task.completed ? 'completed' : ''} ${this.isTaskOverdue(task) ? 'overdue' : ''}`;
        taskDiv.dataset.taskId = task.id;
        taskDiv.setAttribute('role', 'article');
        taskDiv.setAttribute('aria-labelledby', `task-title-${task.id}`);

        const dueDateText = task.dueDate ? Utils.formatDate(task.dueDate, 'relative') : '';
        const tagsHTML = task.tags ? task.tags.map(tag => 
            `<span class="task-tag">${Utils.escapeHTML(tag)}</span>`
        ).join('') : '';

        taskDiv.innerHTML = `
            <div class="task-header">
                <label class="task-checkbox" for="checkbox-${task.id}">
                    <input 
                        type="checkbox" 
                        id="checkbox-${task.id}"
                        class="task-checkbox-input sr-only" 
                        ${task.completed ? 'checked' : ''}
                        aria-label="Mark task as ${task.completed ? 'incomplete' : 'complete'}"
                    >
                    <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                         role="checkbox" 
                         aria-checked="${task.completed}"
                         tabindex="0"></div>
                </label>
                
                <div class="task-content">
                    <h3 class="task-title" id="task-title-${task.id}">
                        ${Utils.escapeHTML(task.title)}
                    </h3>
                    ${task.description ? `<p class="task-description">${Utils.escapeHTML(task.description)}</p>` : ''}
                    
                    <div class="task-meta">
                        ${tagsHTML ? `<div class="task-tags">${tagsHTML}</div>` : ''}
                        <span class="task-priority ${task.priority}">${task.priority}</span>
                        ${dueDateText ? `<span class="task-due-date">${dueDateText}</span>` : ''}
                        <span class="task-created">Created ${Utils.formatDate(task.createdAt, 'relative')}</span>
                    </div>
                </div>
                
                <div class="task-actions">
                    <button 
                        class="task-action-btn edit" 
                        data-action="edit" 
                        aria-label="Edit task"
                        title="Edit task"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button 
                        class="task-action-btn delete" 
                        data-action="delete" 
                        aria-label="Delete task"
                        title="Delete task"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Add animation
        taskDiv.classList.add('slide-in-up');

        return taskDiv;
    }

    /**
     * Update task statistics
     */
    updateStats(stats) {
        if (this.elements.totalTasks) {
            this.elements.totalTasks.textContent = stats.total;
        }
        if (this.elements.pendingTasks) {
            this.elements.pendingTasks.textContent = stats.pending;
        }
        if (this.elements.completedTasks) {
            this.elements.completedTasks.textContent = stats.completed;
        }
        if (this.elements.completionRate) {
            this.elements.completionRate.textContent = `${stats.completionRate}%`;
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        this.hideStates();
        if (this.elements.loadingState) {
            this.elements.loadingState.classList.remove('hidden');
        }
    }

    /**
     * Show empty state
     */
    showEmptyState() {
        this.hideStates();
        if (this.elements.emptyState) {
            this.elements.emptyState.classList.remove('hidden');
        }
    }

    /**
     * Hide all states
     */
    hideStates() {
        if (this.elements.loadingState) {
            this.elements.loadingState.classList.add('hidden');
        }
        if (this.elements.emptyState) {
            this.elements.emptyState.classList.add('hidden');
        }
    }

    /**
     * Check if task is overdue
     */
    isTaskOverdue(task) {
        return task.dueDate && !task.completed && Utils.isOverdue(task.dueDate);
    }

    /**
     * Announce tasks update to screen readers
     */
    announceTasksUpdate(count) {
        const message = `${count} task${count === 1 ? '' : 's'} displayed`;
        this.announceToScreenReader(message);
    }

    /**
     * Announce message to screen readers
     */
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    /**
     * Show field error
     */
    showFieldError(field, message) {
        this.clearFieldError(field);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <svg class="error-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            ${Utils.escapeHTML(message)}
        `;
        
        field.parentNode.classList.add('error');
        field.parentNode.appendChild(errorDiv);
        field.setAttribute('aria-invalid', 'true');
        field.focus();
    }

    /**
     * Clear field error
     */
    clearFieldError(field) {
        const errorDiv = field.parentNode.querySelector('.error-message');
        if (errorDiv) {
            field.parentNode.removeChild(errorDiv);
        }
        field.parentNode.classList.remove('error');
        field.removeAttribute('aria-invalid');
    }

    /**
     * Clear all field errors
     */
    clearFieldErrors() {
        const errorDivs = document.querySelectorAll('.error-message');
        errorDivs.forEach(div => div.remove());
        
        const errorGroups = document.querySelectorAll('.form-group.error');
        errorGroups.forEach(group => group.classList.remove('error'));
        
        const invalidFields = document.querySelectorAll('[aria-invalid="true"]');
        invalidFields.forEach(field => field.removeAttribute('aria-invalid'));
    }

    /**
     * Show validation errors
     */
    showValidationErrors(errors) {
        Object.keys(errors).forEach(field => {
            const element = document.getElementById(field === 'title' ? 'task-input' : `task-${field}`);
            if (element) {
                this.showFieldError(element, errors[field]);
            }
        });
    }

    // Modal methods and other UI operations continue...
    // (Due to length limits, continuing with key methods)

    /**
     * Open settings modal
     */
    openSettingsModal() {
        if (this.elements.settingsModal) {
            this.openModal(this.elements.settingsModal);
        }
    }

    /**
     * Open edit task modal
     */
    openEditTaskModal(taskId) {
        // This would populate and show the edit task modal
        // For now, just show a placeholder
        console.log('Edit task:', taskId);
        if (this.elements.taskModal) {
            this.openModal(this.elements.taskModal);
        }
    }

    /**
     * Confirm delete task
     */
    confirmDeleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            const event = new CustomEvent('taskDelete', { 
                detail: { taskId } 
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Handle export
     */
    handleExport() {
        const event = new CustomEvent('exportData');
        document.dispatchEvent(event);
    }

    /**
     * Handle import
     */
    handleImport() {
        if (this.elements.importFileInput) {
            this.elements.importFileInput.click();
        }
    }

    /**
     * Handle file import
     */
    handleFileImport(e) {
        const file = e.target.files[0];
        if (file) {
            const event = new CustomEvent('importData', { 
                detail: { file } 
            });
            document.dispatchEvent(event);
            // Reset input
            e.target.value = '';
        }
    }

    /**
     * Handle clear completed
     */
    handleClearCompleted() {
        if (confirm('Are you sure you want to clear all completed tasks?')) {
            const event = new CustomEvent('clearCompleted');
            document.dispatchEvent(event);
        }
    }

    /**
     * Handle notification toggle
     */
    async handleNotificationToggle(e) {
        const enabled = e.target.checked;
        
        if (enabled) {
            try {
                // Request permission through notification manager
                if (window.notificationManager) {
                    await window.notificationManager.requestPermission();
                }
                
                const event = new CustomEvent('settingsChange', {
                    detail: {
                        settings: { notificationsEnabled: true }
                    }
                });
                document.dispatchEvent(event);
            } catch (error) {
                e.target.checked = false;
                if (window.notificationManager) {
                    window.notificationManager.showPermissionDeniedMessage();
                }
            }
        } else {
            const event = new CustomEvent('settingsChange', {
                detail: {
                    settings: { notificationsEnabled: false }
                }
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Handle clear all data
     */
    handleClearAllData() {
        const event = new CustomEvent('clearAllData');
        document.dispatchEvent(event);
    }

    /**
     * Handle edit task form submission
     */
    handleEditTask(e) {
        e.preventDefault();
        // This would handle editing a task
        // For now, just close the modal
        this.closeModal(this.elements.taskModal);
    }

    /**
     * Open modal
     */
    openModal(modal) {
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        
        // Focus first focusable element
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close modal
     */
    closeModal(modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Return focus to trigger element if available
        const trigger = document.querySelector(`[data-modal="${modal.id}"]`);
        if (trigger) {
            trigger.focus();
        }
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        const modals = document.querySelectorAll('.modal:not(.hidden)');
        modals.forEach(modal => this.closeModal(modal));
    }

    // Additional methods for modal handling, export/import, etc.
    // would continue here...
}

// Create global instance
if (typeof window !== 'undefined') {
    window.UIManager = UIManager;
}