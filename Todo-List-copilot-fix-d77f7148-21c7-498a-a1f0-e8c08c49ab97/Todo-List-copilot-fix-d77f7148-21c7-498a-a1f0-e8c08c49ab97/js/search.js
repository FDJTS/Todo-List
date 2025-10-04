// Search Manager
class SearchManager {
  constructor(app) {
    this.app = app;
    this.query = '';
    this.searchHistory = [];
    this.maxHistory = 10;
    
    this.loadSearchHistory();
  }

  setQuery(query) {
    this.query = query.trim().toLowerCase();
    this.app.ui.render();
    this.app.ui.updateFilterUI();
    
    // Add to search history if not empty and not duplicate
    if (this.query && !this.searchHistory.includes(this.query)) {
      this.searchHistory.unshift(this.query);
      if (this.searchHistory.length > this.maxHistory) {
        this.searchHistory.pop();
      }
      this.saveSearchHistory();
    }
  }

  clear() {
    document.getElementById('searchInput').value = '';
    this.setQuery('');
  }

  filterTasks(tasks) {
    if (!this.query) return tasks;
    
    return tasks.filter(task => this.matchesQuery(task, this.query));
  }

  matchesQuery(task, query) {
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    
    return searchTerms.every(term => {
      return (
        task.title.toLowerCase().includes(term) ||
        task.description.toLowerCase().includes(term) ||
        task.tags.some(tag => tag.toLowerCase().includes(term)) ||
        task.priority.toLowerCase().includes(term) ||
        this.matchesSpecialQueries(task, term)
      );
    });
  }

  matchesSpecialQueries(task, term) {
    // Special search queries
    switch (term) {
      case 'completed':
      case 'done':
        return task.completed;
      
      case 'pending':
      case 'todo':
      case 'incomplete':
        return !task.completed;
      
      case 'overdue':
        return task.isOverdue();
      
      case 'today':
        return this.isDueToday(task);
      
      case 'tomorrow':
        return this.isDueTomorrow(task);
      
      case 'thisweek':
      case 'week':
        return this.isDueThisWeek(task);
      
      case 'recurring':
      case 'repeat':
        return !!task.recurrence;
      
      case 'high':
      case 'medium':
      case 'low':
        return task.priority === term;
      
      case 'notag':
      case 'untagged':
        return task.tags.length === 0;
      
      case 'nodue':
      case 'noduedate':
        return !task.dueDate;
      
      case 'related':
        return task.relations && task.relations.length > 0;
      
      default:
        // Check if it's a tag search (starts with #)
        if (term.startsWith('#')) {
          const tag = term.substring(1);
          return task.tags.some(t => t.toLowerCase().includes(tag));
        }
        
        // Check if it's a date search
        if (this.isDateQuery(term)) {
          return this.matchesDateQuery(task, term);
        }
        
        return false;
    }
  }

  isDueToday(task) {
    if (!task.dueDate) return false;
    const today = new Date();
    const dueDate = new Date(task.dueDate);
    return today.toDateString() === dueDate.toDateString();
  }

  isDueTomorrow(task) {
    if (!task.dueDate) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDate = new Date(task.dueDate);
    return tomorrow.toDateString() === dueDate.toDateString();
  }

  isDueThisWeek(task) {
    if (!task.dueDate) return false;
    const today = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(today.getDate() + 7);
    const dueDate = new Date(task.dueDate);
    return dueDate >= today && dueDate <= weekFromNow;
  }

  isDateQuery(term) {
    // Simple date pattern matching
    return /^\d{4}-\d{2}-\d{2}$/.test(term) || 
           /^\d{2}\/\d{2}\/\d{4}$/.test(term) ||
           /^\d{1,2}\/\d{1,2}$/.test(term);
  }

  matchesDateQuery(task, dateStr) {
    if (!task.dueDate) return false;
    
    try {
      const taskDate = new Date(task.dueDate);
      let queryDate;
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // YYYY-MM-DD format
        queryDate = new Date(dateStr);
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        // MM/DD/YYYY format
        queryDate = new Date(dateStr);
      } else if (/^\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        // MM/DD format (assume current year)
        const [month, day] = dateStr.split('/');
        queryDate = new Date(new Date().getFullYear(), month - 1, day);
      }
      
      if (queryDate && !isNaN(queryDate)) {
        return taskDate.toDateString() === queryDate.toDateString();
      }
    } catch (e) {
      // Invalid date format
    }
    
    return false;
  }

  getSearchSuggestions(partialQuery) {
    const suggestions = [];
    const query = partialQuery.toLowerCase();
    
    // Special search terms
    const specialTerms = [
      'completed', 'pending', 'overdue', 'today', 'tomorrow', 'thisweek',
      'recurring', 'high', 'medium', 'low', 'notag', 'nodue', 'related'
    ];
    
    specialTerms.forEach(term => {
      if (term.includes(query)) {
        suggestions.push(term);
      }
    });
    
    // Tag suggestions
    this.app.getAllTags().forEach(tag => {
      if (tag.includes(query)) {
        suggestions.push('#' + tag);
      }
    });
    
    // Task title suggestions
    this.app.tasks.forEach(task => {
      if (task.title.toLowerCase().includes(query)) {
        const words = task.title.split(' ');
        words.forEach(word => {
          if (word.toLowerCase().includes(query) && !suggestions.includes(word)) {
            suggestions.push(word);
          }
        });
      }
    });
    
    // Search history suggestions
    this.searchHistory.forEach(historyItem => {
      if (historyItem.includes(query) && !suggestions.includes(historyItem)) {
        suggestions.push(historyItem);
      }
    });
    
    return suggestions.slice(0, 8); // Limit to 8 suggestions
  }

  highlightSearchResults(text, query) {
    if (!query || !text) return text;
    
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    let highlightedText = text;
    
    searchTerms.forEach(term => {
      const regex = new RegExp(`(${this.escapeRegExp(term)})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    
    return highlightedText;
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getSearchStats() {
    const tasks = this.app.tasks;
    const filteredTasks = this.filterTasks(tasks);
    
    return {
      total: tasks.length,
      filtered: filteredTasks.length,
      query: this.query,
      hasActiveSearch: !!this.query
    };
  }

  saveSearchHistory() {
    try {
      localStorage.setItem('todo-search-history', JSON.stringify(this.searchHistory));
    } catch (e) {
      console.warn('Could not save search history:', e);
    }
  }

  loadSearchHistory() {
    try {
      const saved = localStorage.getItem('todo-search-history');
      if (saved) {
        this.searchHistory = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not load search history:', e);
      this.searchHistory = [];
    }
  }

  clearSearchHistory() {
    this.searchHistory = [];
    this.saveSearchHistory();
  }

  // Advanced search functionality
  buildAdvancedQuery(filters) {
    const queryParts = [];
    
    if (filters.text) {
      queryParts.push(filters.text);
    }
    
    if (filters.status) {
      queryParts.push(filters.status);
    }
    
    if (filters.priority) {
      queryParts.push(filters.priority);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach(tag => {
        queryParts.push('#' + tag);
      });
    }
    
    if (filters.dateRange) {
      if (filters.dateRange === 'today') {
        queryParts.push('today');
      } else if (filters.dateRange === 'week') {
        queryParts.push('thisweek');
      } else if (filters.dateRange === 'overdue') {
        queryParts.push('overdue');
      }
    }
    
    return queryParts.join(' ');
  }

  exportSearchResults() {
    const filteredTasks = this.app.getFilteredTasks();
    const searchQuery = this.query;
    
    return {
      query: searchQuery,
      timestamp: new Date().toISOString(),
      resultsCount: filteredTasks.length,
      tasks: filteredTasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        completed: task.completed,
        priority: task.priority,
        tags: task.tags,
        dueDate: task.dueDate,
        createdAt: task.createdAt
      }))
    };
  }
}