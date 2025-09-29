// Task Model
class Task {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.title = data.title || '';
    this.description = data.description || '';
    this.completed = data.completed || false;
    this.priority = data.priority || 'medium';
    this.tags = data.tags || [];
    this.dueDate = data.dueDate || null;
    this.recurrence = data.recurrence || null;
    this.relations = data.relations || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.completedAt = data.completedAt || null;
    this.notifiedOverdue = data.notifiedOverdue || false;
  }

  generateId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  isOverdue() {
    return !this.completed && this.dueDate && new Date(this.dueDate) < new Date();
  }

  getDueDateFormatted() {
    if (!this.dueDate) return null;
    
    const date = new Date(this.dueDate);
    const now = new Date();
    
    // Same day
    if (date.toDateString() === now.toDateString()) {
      return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // This week
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    if (date < weekFromNow) {
      return date.toLocaleDateString([], { weekday: 'long' }) + ' at ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Future
    return date.toLocaleDateString([], { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getRelativeTimeString() {
    const now = new Date();
    const created = new Date(this.createdAt);
    const diffMs = now - created;
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  getPriorityColor() {
    switch (this.priority) {
      case 'high': return '#dc2626';
      case 'medium': return '#d97706';
      case 'low': return '#059669';
      default: return '#64748b';
    }
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      completed: this.completed,
      priority: this.priority,
      tags: this.tags,
      dueDate: this.dueDate,
      recurrence: this.recurrence,
      relations: this.relations,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
      notifiedOverdue: this.notifiedOverdue
    };
  }

  static fromJSON(data) {
    return new Task(data);
  }

  clone() {
    return new Task(this.toJSON());
  }

  addTag(tag) {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !this.tags.includes(trimmedTag)) {
      this.tags.push(trimmedTag);
      this.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  addRelation(taskId) {
    if (taskId !== this.id && !this.relations.includes(taskId)) {
      this.relations.push(taskId);
      this.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  removeRelation(taskId) {
    const index = this.relations.indexOf(taskId);
    if (index > -1) {
      this.relations.splice(index, 1);
      this.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  matches(query) {
    if (!query) return true;
    
    const searchText = query.toLowerCase();
    return (
      this.title.toLowerCase().includes(searchText) ||
      this.description.toLowerCase().includes(searchText) ||
      this.tags.some(tag => tag.toLowerCase().includes(searchText)) ||
      this.priority.toLowerCase().includes(searchText)
    );
  }

  validate() {
    const errors = [];
    
    if (!this.title || this.title.trim() === '') {
      errors.push('Title is required');
    }
    
    if (this.title && this.title.length > 500) {
      errors.push('Title must be less than 500 characters');
    }
    
    if (this.description && this.description.length > 2000) {
      errors.push('Description must be less than 2000 characters');
    }
    
    if (this.priority && !['low', 'medium', 'high'].includes(this.priority)) {
      errors.push('Priority must be low, medium, or high');
    }
    
    if (this.dueDate && isNaN(new Date(this.dueDate).getTime())) {
      errors.push('Due date is invalid');
    }
    
    if (this.recurrence && !['', 'daily', 'weekly', 'monthly', 'yearly'].includes(this.recurrence)) {
      errors.push('Recurrence must be daily, weekly, monthly, or yearly');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getEstimatedDuration() {
    // Simple heuristic based on title length and description
    const titleWords = this.title.split(' ').length;
    const descWords = this.description ? this.description.split(' ').length : 0;
    
    let minutes = Math.max(15, titleWords * 5 + descWords * 2);
    
    // Adjust for priority
    switch (this.priority) {
      case 'high': minutes *= 1.5; break;
      case 'low': minutes *= 0.8; break;
    }
    
    // Round to nearest 15 minutes
    return Math.round(minutes / 15) * 15;
  }

  getProgressPercentage() {
    // Simple implementation - could be enhanced with subtasks
    return this.completed ? 100 : 0;
  }

  shouldNotifyDueSoon() {
    if (!this.dueDate || this.completed) return false;
    
    const now = new Date();
    const due = new Date(this.dueDate);
    const hoursUntilDue = (due - now) / (1000 * 60 * 60);
    
    // Notify if due within 1 hour for high priority, 2 hours for medium, 4 hours for low
    const thresholds = { high: 1, medium: 2, low: 4 };
    return hoursUntilDue <= thresholds[this.priority] && hoursUntilDue > 0;
  }

  getNextRecurrenceDate() {
    if (!this.dueDate || !this.recurrence) return null;
    
    const date = new Date(this.dueDate);
    
    switch (this.recurrence) {
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
    }
    
    return date;
  }
}