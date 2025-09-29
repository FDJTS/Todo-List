/**
 * Notification Manager for Todo List App
 * Handles browser notifications, toast messages, and reminders
 */

class NotificationManager {
    constructor() {
        this.permission = Notification.permission;
        this.toastContainer = null;
        this.activeReminders = new Map();
        this.isSupported = 'Notification' in window;
        this.init();
    }

    /**
     * Initialize notification manager
     */
    init() {
        this.createToastContainer();
        this.bindEvents();
    }

    /**
     * Create toast container if it doesn't exist
     */
    createToastContainer() {
        this.toastContainer = document.getElementById('toast-container');
        if (!this.toastContainer) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.id = 'toast-container';
            this.toastContainer.className = 'toast-container';
            this.toastContainer.setAttribute('aria-live', 'polite');
            this.toastContainer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(this.toastContainer);
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Handle visibility change to manage reminders
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseReminders();
            } else {
                this.resumeReminders();
            }
        });

        // Handle page unload to clean up
        window.addEventListener('beforeunload', () => {
            this.clearAllReminders();
        });
    }

    /**
     * Request notification permission
     * @returns {Promise<string>} Permission status
     */
    async requestPermission() {
        if (!this.isSupported) {
            throw new Error('Notifications not supported in this browser');
        }

        if (this.permission === 'granted') {
            return 'granted';
        }

        if (this.permission === 'denied') {
            throw new Error('Notification permission denied');
        }

        try {
            this.permission = await Notification.requestPermission();
            return this.permission;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            throw error;
        }
    }

    /**
     * Show browser notification
     * @param {string} title - Notification title
     * @param {Object} options - Notification options
     * @returns {Notification|null} Notification instance
     */
    showNotification(title, options = {}) {
        if (!this.isSupported || this.permission !== 'granted') {
            console.warn('Cannot show notification: permission not granted');
            return null;
        }

        const defaultOptions = {
            icon: this.getNotificationIcon(),
            badge: this.getNotificationIcon(),
            tag: 'todo-reminder',
            requireInteraction: false,
            silent: false,
            ...options
        };

        try {
            const notification = new Notification(title, defaultOptions);
            
            // Auto-close after 5 seconds if not set to requireInteraction
            if (!defaultOptions.requireInteraction) {
                setTimeout(() => {
                    notification.close();
                }, 5000);
            }

            return notification;
        } catch (error) {
            console.error('Error showing notification:', error);
            return null;
        }
    }

    /**
     * Get notification icon
     * @returns {string} Icon data URL
     */
    getNotificationIcon() {
        return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'%3E%3Cpath d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'/%3E%3C/svg%3E";
    }

    /**
     * Show toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {number} duration - Duration in milliseconds
     * @param {string} title - Optional title
     */
    showToast(message, type = 'info', duration = 4000, title = '') {
        const toast = this.createToastElement(message, type, title);
        this.toastContainer.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('fade-in');
        });

        // Auto-remove toast
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }

        return toast;
    }

    /**
     * Create toast element
     * @param {string} message - Toast message
     * @param {string} type - Toast type
     * @param {string} title - Optional title
     * @returns {HTMLElement} Toast element
     */
    createToastElement(message, type, title) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');

        const icon = this.getToastIcon(type);
        const titleHTML = title ? `<div class="toast-title">${Utils.escapeHTML(title)}</div>` : '';
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                ${titleHTML}
                <div class="toast-message">${Utils.escapeHTML(message)}</div>
            </div>
            <button class="toast-close" aria-label="Close notification">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        `;

        // Add close functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });

        return toast;
    }

    /**
     * Get icon for toast type
     * @param {string} type - Toast type
     * @returns {string} SVG icon
     */
    getToastIcon(type) {
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="color: #10b981;"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="color: #ef4444;"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="color: #f59e0b;"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="color: #06b6d4;"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        };
        return icons[type] || icons.info;
    }

    /**
     * Remove toast notification
     * @param {HTMLElement} toast - Toast element to remove
     */
    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }

    /**
     * Clear all toast notifications
     */
    clearAllToasts() {
        const toasts = this.toastContainer.querySelectorAll('.toast');
        toasts.forEach(toast => this.removeToast(toast));
    }

    /**
     * Set reminder for a task
     * @param {Object} task - Task object
     * @param {Date} reminderTime - When to remind
     */
    setTaskReminder(task, reminderTime) {
        if (!task || !reminderTime) return;

        const now = new Date();
        const delay = reminderTime.getTime() - now.getTime();

        if (delay <= 0) {
            console.warn('Reminder time is in the past');
            return;
        }

        // Clear existing reminder for this task
        this.clearTaskReminder(task.id);

        const timeoutId = setTimeout(() => {
            this.showTaskReminder(task);
        }, delay);

        this.activeReminders.set(task.id, {
            timeoutId,
            reminderTime,
            task: Utils.deepClone(task)
        });
    }

    /**
     * Show task reminder notification
     * @param {Object} task - Task object
     */
    showTaskReminder(task) {
        const title = 'Task Reminder';
        const body = `Don't forget: ${task.title}`;
        
        // Try to show browser notification first
        if (this.permission === 'granted') {
            const notification = this.showNotification(title, {
                body,
                tag: `task-${task.id}`,
                data: { taskId: task.id },
                actions: [
                    { action: 'mark-complete', title: 'Mark Complete' },
                    { action: 'snooze', title: 'Snooze 10min' }
                ]
            });

            if (notification) {
                notification.onclick = () => {
                    window.focus();
                    this.focusTask(task.id);
                    notification.close();
                };

                notification.onshow = () => {
                    // Play notification sound if enabled
                    this.playNotificationSound();
                };
            }
        }

        // Always show toast as fallback
        this.showToast(body, 'warning', 0, title);

        // Remove from active reminders
        this.activeReminders.delete(task.id);
    }

    /**
     * Clear reminder for a task
     * @param {string} taskId - Task ID
     */
    clearTaskReminder(taskId) {
        const reminder = this.activeReminders.get(taskId);
        if (reminder) {
            clearTimeout(reminder.timeoutId);
            this.activeReminders.delete(taskId);
        }
    }

    /**
     * Clear all reminders
     */
    clearAllReminders() {
        this.activeReminders.forEach((reminder) => {
            clearTimeout(reminder.timeoutId);
        });
        this.activeReminders.clear();
    }

    /**
     * Pause all reminders (when tab is hidden)
     */
    pauseReminders() {
        // Browser notifications still work when tab is hidden
        // This is mainly for managing state
        console.log('Reminders paused (tab hidden)');
    }

    /**
     * Resume reminders (when tab becomes visible)
     */
    resumeReminders() {
        console.log('Reminders resumed (tab visible)');
        // Check for any overdue reminders and show them
        this.checkOverdueReminders();
    }

    /**
     * Check for overdue reminders
     */
    checkOverdueReminders() {
        const now = new Date();
        this.activeReminders.forEach((reminder, taskId) => {
            if (reminder.reminderTime <= now) {
                this.showTaskReminder(reminder.task);
            }
        });
    }

    /**
     * Focus a specific task in the UI
     * @param {string} taskId - Task ID to focus
     */
    focusTask(taskId) {
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
            taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            taskElement.focus();
            
            // Highlight the task briefly
            taskElement.classList.add('highlighted');
            setTimeout(() => {
                taskElement.classList.remove('highlighted');
            }, 2000);
        }
    }

    /**
     * Play notification sound
     */
    playNotificationSound() {
        // Create a subtle notification sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    }

    /**
     * Set daily reminder for pending tasks
     * @param {number} hour - Hour (0-23)
     * @param {number} minute - Minute (0-59)
     */
    setDailyReminder(hour = 9, minute = 0) {
        // Clear existing daily reminder
        if (this.dailyReminderInterval) {
            clearInterval(this.dailyReminderInterval);
        }

        const scheduleNextReminder = () => {
            const now = new Date();
            const reminder = new Date();
            reminder.setHours(hour, minute, 0, 0);

            // If time has passed today, schedule for tomorrow
            if (reminder <= now) {
                reminder.setDate(reminder.getDate() + 1);
            }

            const delay = reminder.getTime() - now.getTime();

            setTimeout(() => {
                this.showDailyReminder();
                // Schedule next reminder (24 hours later)
                this.dailyReminderInterval = setInterval(() => {
                    this.showDailyReminder();
                }, 24 * 60 * 60 * 1000);
            }, delay);
        };

        scheduleNextReminder();
    }

    /**
     * Show daily reminder with task summary
     */
    showDailyReminder() {
        // This would typically get pending tasks from the app
        // For now, we'll trigger a custom event that the app can listen to
        const event = new CustomEvent('dailyReminder', {
            detail: { timestamp: new Date() }
        });
        document.dispatchEvent(event);
    }

    /**
     * Get notification status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isSupported: this.isSupported,
            permission: this.permission,
            activeReminders: this.activeReminders.size,
            hasActiveToasts: this.toastContainer.children.length > 0
        };
    }

    /**
     * Show permission denied message
     */
    showPermissionDeniedMessage() {
        this.showToast(
            'Browser notifications are disabled. You can enable them in your browser settings.',
            'warning',
            0,
            'Notifications Disabled'
        );
    }

    /**
     * Show success message for task completion
     * @param {string} taskTitle - Title of completed task
     */
    showTaskCompleted(taskTitle) {
        this.showToast(
            `"${taskTitle}" has been completed!`,
            'success',
            3000,
            'Task Completed'
        );
    }

    /**
     * Show error message
     * @param {string} message - Error message
     * @param {string} title - Optional title
     */
    showError(message, title = 'Error') {
        this.showToast(message, 'error', 0, title);
    }

    /**
     * Show success message
     * @param {string} message - Success message
     * @param {string} title - Optional title
     */
    showSuccess(message, title = 'Success') {
        this.showToast(message, 'success', 3000, title);
    }

    /**
     * Show warning message
     * @param {string} message - Warning message
     * @param {string} title - Optional title
     */
    showWarning(message, title = 'Warning') {
        this.showToast(message, 'warning', 4000, title);
    }

    /**
     * Show info message
     * @param {string} message - Info message
     * @param {string} title - Optional title
     */
    showInfo(message, title = 'Info') {
        this.showToast(message, 'info', 3000, title);
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.NotificationManager = NotificationManager;
}