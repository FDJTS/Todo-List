/**
 * Utility Functions for Todo List App
 * Contains helper functions for common operations
 */

/**
 * Debounce function to limit the rate of function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function
 */
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

/**
 * Throttle function to limit function execution frequency
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escape HTML entities
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    
    const entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;'
    };
    
    return str.replace(/[&<>"'\/]/g, s => entityMap[s]);
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type ('short', 'long', 'relative')
 * @returns {string} Formatted date
 */
function formatDate(date, format = 'short') {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '';
    
    const now = new Date();
    const diffTime = dateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    switch (format) {
        case 'relative':
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Tomorrow';
            if (diffDays === -1) return 'Yesterday';
            if (diffDays > 0) return `In ${diffDays} days`;
            if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
            break;
            
        case 'long':
            return dateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
        default:
            return dateObj.toLocaleDateString();
    }
}

/**
 * Check if a date is overdue
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if overdue
 */
function isOverdue(date) {
    if (!date) return false;
    const dateObj = date instanceof Date ? date : new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateObj.getTime() < today.getTime();
}

/**
 * Get priority color class
 * @param {string} priority - Priority level
 * @returns {string} CSS class name
 */
function getPriorityClass(priority) {
    const priorities = {
        'high': 'high',
        'medium': 'medium',
        'low': 'low'
    };
    return priorities[priority] || 'medium';
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate task data
 * @param {Object} task - Task object to validate
 * @returns {Object} Validation result
 */
function validateTask(task) {
    const errors = {};
    
    if (!task.title || task.title.trim().length === 0) {
        errors.title = 'Title is required';
    } else if (task.title.length > 200) {
        errors.title = 'Title must be less than 200 characters';
    }
    
    if (task.description && task.description.length > 500) {
        errors.description = 'Description must be less than 500 characters';
    }
    
    if (task.dueDate) {
        const date = new Date(task.dueDate);
        if (isNaN(date.getTime())) {
            errors.dueDate = 'Invalid date format';
        }
    }
    
    if (task.priority && !['low', 'medium', 'high'].includes(task.priority)) {
        errors.priority = 'Invalid priority level';
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }
}

/**
 * Search text in string (case insensitive)
 * @param {string} text - Text to search in
 * @param {string} query - Search query
 * @returns {boolean} True if found
 */
function searchText(text, query) {
    if (!text || !query) return false;
    return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Highlight search terms in text
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {string} Text with highlighted terms
 */
function highlightSearchTerms(text, query) {
    if (!text || !query) return escapeHTML(text);
    
    const escapedText = escapeHTML(text);
    const escapedQuery = escapeHTML(query);
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    
    return escapedText.replace(regex, '<mark>$1</mark>');
}

/**
 * Convert array to comma-separated string
 * @param {Array} arr - Array to convert
 * @returns {string} Comma-separated string
 */
function arrayToString(arr) {
    if (!Array.isArray(arr)) return '';
    return arr.filter(item => item && item.trim()).join(', ');
}

/**
 * Convert comma-separated string to array
 * @param {string} str - String to convert
 * @returns {Array} Array of strings
 */
function stringToArray(str) {
    if (typeof str !== 'string') return [];
    return str.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Sort tasks by various criteria
 * @param {Array} tasks - Tasks to sort
 * @param {string} sortBy - Sort criteria
 * @param {string} direction - Sort direction ('asc' or 'desc')
 * @returns {Array} Sorted tasks
 */
function sortTasks(tasks, sortBy = 'created', direction = 'desc') {
    const sortedTasks = [...tasks];
    
    sortedTasks.sort((a, b) => {
        let aVal, bVal;
        
        switch (sortBy) {
            case 'title':
                aVal = a.title.toLowerCase();
                bVal = b.title.toLowerCase();
                return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                
            case 'due':
                aVal = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                bVal = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
                
            case 'priority':
                const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                aVal = priorityOrder[a.priority] || 2;
                bVal = priorityOrder[b.priority] || 2;
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
                
            case 'completed':
                aVal = a.completed ? 1 : 0;
                bVal = b.completed ? 1 : 0;
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
                
            default: // created
                aVal = new Date(a.createdAt).getTime();
                bVal = new Date(b.createdAt).getTime();
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
    });
    
    return sortedTasks;
}

/**
 * Filter tasks based on criteria
 * @param {Array} tasks - Tasks to filter
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered tasks
 */
function filterTasks(tasks, filters = {}) {
    return tasks.filter(task => {
        // Status filter
        if (filters.status === 'completed' && !task.completed) return false;
        if (filters.status === 'pending' && task.completed) return false;
        if (filters.status === 'overdue' && (!task.dueDate || !isOverdue(task.dueDate) || task.completed)) return false;
        
        // Priority filter
        if (filters.priority && filters.priority !== 'all' && task.priority !== filters.priority) return false;
        
        // Search query
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const titleMatch = task.title.toLowerCase().includes(searchLower);
            const descMatch = task.description && task.description.toLowerCase().includes(searchLower);
            const tagMatch = task.tags && task.tags.some(tag => tag.toLowerCase().includes(searchLower));
            
            if (!titleMatch && !descMatch && !tagMatch) return false;
        }
        
        // Tag filter
        if (filters.tags && filters.tags.length > 0) {
            if (!task.tags || !filters.tags.some(tag => task.tags.includes(tag))) return false;
        }
        
        return true;
    });
}

/**
 * Calculate task statistics
 * @param {Array} tasks - Tasks to analyze
 * @returns {Object} Statistics object
 */
function calculateStats(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const pending = total - completed;
    const overdue = tasks.filter(task => !task.completed && task.dueDate && isOverdue(task.dueDate)).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const priorities = {
        high: tasks.filter(task => !task.completed && task.priority === 'high').length,
        medium: tasks.filter(task => !task.completed && task.priority === 'medium').length,
        low: tasks.filter(task => !task.completed && task.priority === 'low').length
    };
    
    return {
        total,
        completed,
        pending,
        overdue,
        completionRate,
        priorities
    };
}

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if browser supports a feature
 * @param {string} feature - Feature to check
 * @returns {boolean} True if supported
 */
function supportsFeature(feature) {
    switch (feature) {
        case 'localStorage':
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                return true;
            } catch (e) {
                return false;
            }
            
        case 'notifications':
            return 'Notification' in window;
            
        case 'serviceWorker':
            return 'serviceWorker' in navigator;
            
        case 'indexedDB':
            return 'indexedDB' in window;
            
        default:
            return false;
    }
}

/**
 * Create a download link for data
 * @param {string} data - Data to download
 * @param {string} filename - File name
 * @param {string} type - MIME type
 */
function downloadData(data, filename, type = 'application/json') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Parse tags from a string
 * @param {string} tagsString - Comma-separated tags
 * @returns {Array} Array of unique, clean tags
 */
function parseTags(tagsString) {
    if (!tagsString) return [];
    
    return tagsString
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter((tag, index, arr) => tag.length > 0 && arr.indexOf(tag) === index)
        .slice(0, 10); // Limit to 10 tags
}

/**
 * Get all unique tags from tasks
 * @param {Array} tasks - Array of tasks
 * @returns {Array} Array of unique tags
 */
function getAllTags(tasks) {
    const tagSet = new Set();
    tasks.forEach(task => {
        if (task.tags) {
            task.tags.forEach(tag => tagSet.add(tag));
        }
    });
    return Array.from(tagSet).sort();
}

// Export utility functions for use in other modules
if (typeof window !== 'undefined') {
    window.Utils = {
        debounce,
        throttle,
        sanitizeHTML,
        escapeHTML,
        generateId,
        formatDate,
        isOverdue,
        getPriorityClass,
        isValidEmail,
        validateTask,
        deepClone,
        searchText,
        highlightSearchTerms,
        arrayToString,
        stringToArray,
        sortTasks,
        filterTasks,
        calculateStats,
        formatFileSize,
        supportsFeature,
        downloadData,
        parseTags,
        getAllTags
    };
}