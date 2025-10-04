// Notifications Manager
class NotificationManager {
  constructor() {
    this.container = document.getElementById('notificationContainer');
    this.notifications = [];
    this.maxNotifications = 5;
    this.defaultDuration = 5000; // 5 seconds
    
    this.requestPermission();
  }

  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
      } catch (error) {
        console.warn('Notification permission request failed:', error);
      }
    }
  }

  show(message, type = 'info', duration = null) {
    const notification = this.createNotification(message, type, duration);
    this.addToContainer(notification);
    
    // Auto remove after duration
    const timeout = setTimeout(() => {
      this.remove(notification.id);
    }, duration || this.defaultDuration);

    this.notifications.push({
      id: notification.id,
      element: notification,
      timeout
    });

    // Limit number of notifications
    if (this.notifications.length > this.maxNotifications) {
      const oldest = this.notifications.shift();
      this.remove(oldest.id);
    }

    return notification.id;
  }

  createNotification(message, type, duration) {
    const id = 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.id = id;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');

    const icon = this.getTypeIcon(type);
    const showProgress = duration && duration > 2000;

    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-header">
          <span class="notification-icon">${icon}</span>
          <span class="notification-message">${message}</span>
          <button class="notification-close" aria-label="Close notification">&times;</button>
        </div>
        ${showProgress ? '<div class="notification-progress"><div class="progress-bar"></div></div>' : ''}
      </div>
    `;

    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      this.remove(id);
    });

    // Add progress animation
    if (showProgress) {
      const progressBar = notification.querySelector('.progress-bar');
      progressBar.style.animation = `shrink ${duration}ms linear forwards`;
    }

    // Add click to dismiss (except for error messages)
    if (type !== 'error') {
      notification.addEventListener('click', (e) => {
        if (!e.target.closest('.notification-close')) {
          this.remove(id);
        }
      });
      notification.style.cursor = 'pointer';
    }

    return notification;
  }

  getTypeIcon(type) {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': 
      default: return 'ℹ️';
    }
  }

  addToContainer(notification) {
    // Add with animation
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    
    this.container.appendChild(notification);
    
    // Trigger animation
    requestAnimationFrame(() => {
      notification.style.transition = 'all 0.3s ease-out';
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    });
  }

  remove(id) {
    const notificationData = this.notifications.find(n => n.id === id);
    if (!notificationData) return false;

    // Clear timeout
    if (notificationData.timeout) {
      clearTimeout(notificationData.timeout);
    }

    // Remove from array
    this.notifications = this.notifications.filter(n => n.id !== id);

    // Animate out
    const element = notificationData.element;
    element.style.transition = 'all 0.3s ease-in';
    element.style.transform = 'translateX(100%)';
    element.style.opacity = '0';

    // Remove from DOM after animation
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }, 300);

    return true;
  }

  clear() {
    this.notifications.forEach(notification => {
      this.remove(notification.id);
    });
  }

  // Specialized notification methods
  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 8000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration) {
    return this.show(message, 'info', duration);
  }

  // Browser notifications for important alerts
  async showBrowserNotification(title, options = {}) {
    if (!('Notification' in window)) {
      console.warn('Browser notifications not supported');
      return null;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Browser notification permission not granted');
      return null;
    }

    const defaultOptions = {
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      tag: 'todo-pwa',
      renotify: true,
      requireInteraction: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      
      // Auto close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);

      return notification;
    } catch (error) {
      console.error('Failed to show browser notification:', error);
      return null;
    }
  }

  // Overdue task notifications
  showOverdue(task) {
    const message = `Task "${task.title}" is overdue`;
    
    // In-app notification
    this.warning(message, 8000);
    
    // Browser notification if permission granted
    this.showBrowserNotification('Task Overdue', {
      body: `"${task.title}" was due ${this.getRelativeTime(task.dueDate)}`,
      tag: `overdue-${task.id}`,
      actions: [
        { action: 'complete', title: 'Mark Complete' },
        { action: 'snooze', title: 'Snooze 1h' }
      ]
    });
  }

  // Due soon notifications  
  showDueSoon(task, minutesUntilDue) {
    const timeStr = minutesUntilDue < 60 ? 
      `${minutesUntilDue} minutes` : 
      `${Math.round(minutesUntilDue / 60)} hours`;
    
    const message = `Task "${task.title}" is due in ${timeStr}`;
    
    this.info(message, 6000);
    
    this.showBrowserNotification('Task Due Soon', {
      body: message,
      tag: `due-soon-${task.id}`,
      requireInteraction: true
    });
  }

  // Recurring task notifications
  showRecurringCreated(originalTask, newTask) {
    const message = `Recurring task "${originalTask.title}" created`;
    this.success(message, 4000);
  }

  // Import/Export notifications
  showImportSuccess(count) {
    this.success(`Successfully imported ${count} tasks`, 4000);
  }

  showExportSuccess() {
    this.success('Tasks exported successfully', 3000);
  }

  showImportError(error) {
    this.error(`Import failed: ${error.message}`, 8000);
  }

  // Undo/Redo notifications
  showUndoSuccess(action) {
    this.info(`Undid: ${action}`, 3000);
  }

  showRedoSuccess(action) {
    this.info(`Redid: ${action}`, 3000);
  }

  showUndoLimit() {
    this.warning('No more actions to undo', 3000);
  }

  showRedoLimit() {
    this.warning('No more actions to redo', 3000);
  }

  // Network status notifications
  showOffline() {
    this.warning('You are offline. Changes will sync when you reconnect.', 6000);
  }

  showOnline() {
    this.success('Back online! Syncing changes...', 3000);
  }

  // Theme change notification
  showThemeChanged(themeName) {
    this.info(`Switched to ${themeName} theme`, 2000);
  }

  // Batch operation notifications
  showBatchComplete(operation, count) {
    this.success(`${operation} completed for ${count} tasks`, 4000);
  }

  // Storage notifications
  showStorageFull() {
    this.error('Storage is getting full. Consider exporting old tasks.', 10000);
  }

  showStorageError() {
    this.error('Failed to save data. Please check your storage settings.', 8000);
  }

  // Tour notifications
  showTourCompleted() {
    this.success('🎉 Tour completed! You\'re ready to be productive!', 5000);
  }

  // Custom notification with actions
  showWithActions(message, type, actions, duration) {
    const notification = this.createNotification(message, type, duration);
    
    if (actions && actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'notification-actions';
      actionsContainer.style.cssText = `
        margin-top: 0.5rem;
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      `;

      actions.forEach(action => {
        const button = document.createElement('button');
        button.className = 'btn btn-secondary';
        button.style.fontSize = '0.8rem';
        button.style.padding = '0.25rem 0.5rem';
        button.textContent = action.text;
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          action.handler();
          this.remove(notification.id);
        });
        actionsContainer.appendChild(button);
      });

      notification.querySelector('.notification-content').appendChild(actionsContainer);
    }

    this.addToContainer(notification);
    return notification.id;
  }

  // Utility methods
  getRelativeTime(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  }

  // Notification settings
  setDefaultDuration(duration) {
    this.defaultDuration = duration;
  }

  setMaxNotifications(max) {
    this.maxNotifications = max;
    
    // Remove excess notifications if any
    while (this.notifications.length > max) {
      const oldest = this.notifications.shift();
      this.remove(oldest.id);
    }
  }

  // Get notification statistics
  getStats() {
    return {
      active: this.notifications.length,
      maxAllowed: this.maxNotifications,
      browserPermission: 'Notification' in window ? Notification.permission : 'not-supported'
    };
  }

  // Quarantine notifications
  showQuarantineSummary(count) {
    if (count > 0) {
      this.warning(`${count} task(s) moved to quarantine (invalid data)`, 9000);
    }
  }

  showGlobalError(error, context='Runtime Error') {
    const msg = `${context}: ${error && error.message ? error.message : error}`;
    this.error(msg, 10000);
  }

  showImportDryRun(summary) {
    this.info(`Import analysis: ${summary.add} new, ${summary.duplicate} duplicate, ${summary.invalid} invalid`, 8000);
  }
}

// Add required CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
  .notification-progress {
    margin-top: 0.5rem;
    height: 2px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 1px;
    overflow: hidden;
  }
  
  .progress-bar {
    height: 100%;
    background: rgba(255, 255, 255, 0.8);
    width: 100%;
    transform-origin: left;
  }
  
  @keyframes shrink {
    from { transform: scaleX(1); }
    to { transform: scaleX(0); }
  }
  
  .notification-content {
    position: relative;
  }
  
  .notification-header {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .notification-icon {
    flex-shrink: 0;
    font-size: 1rem;
  }
  
  .notification-message {
    flex: 1;
    font-size: 0.9rem;
    line-height: 1.4;
  }
  
  .notification-close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0;
    opacity: 0.7;
    flex-shrink: 0;
  }
  
  .notification-close:hover {
    opacity: 1;
  }
  
  .notification-actions {
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .notification-actions .btn {
    background: rgba(255, 255, 255, 0.2);
    color: inherit;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
  
  .notification-actions .btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;
document.head.appendChild(notificationStyles);