// UI Manager
class UIManager {
  constructor(app) {
    this.app = app;
    this.currentTask = null;
    this.dragState = {
      dragging: false,
      draggedElement: null,
      placeholder: null
    };
    
    this.setupDragAndDrop();
  }

  render() {
    this.renderTasks();
    this.updateTagFilter();
    this.updateCounters();
  }

  renderTasks() {
    const taskList = document.getElementById('taskList');
    const emptyState = document.getElementById('emptyState');
    const tasks = this.app.getFilteredTasks();

    if (tasks.length === 0) {
      taskList.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    taskList.style.display = 'block';
    emptyState.style.display = 'none';

    taskList.innerHTML = tasks.map(task => this.renderTask(task)).join('');
    
    // Setup task event listeners
    this.setupTaskEventListeners();
  }

  renderTask(task) {
    const dueDate = task.getDueDateFormatted();
    const isOverdue = task.isOverdue();
    const relativeTime = task.getRelativeTimeString();

    return `
      <div class="task-item ${task.completed ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" 
           data-task-id="${task.id}" draggable="true">
        <div class="task-header">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
          <div class="task-content">
            <div class="task-title" ${this.app.editingTaskId === task.id ? 'contenteditable="true"' : ''}
                 data-original-title="${task.title}">${this.escapeHtml(task.title)}</div>
            ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
            <div class="task-meta">
              ${dueDate ? `<span class="task-due-date ${isOverdue ? 'overdue' : ''}">${dueDate}</span>` : ''}
              <span class="task-priority ${task.priority}">${task.priority.toUpperCase()}</span>
              ${task.recurrence ? `<span class="task-recurrence">🔄 ${task.recurrence}</span>` : ''}
              <span class="task-created">Created ${relativeTime}</span>
              ${task.tags.length > 0 ? `
                <div class="task-tags">
                  ${task.tags.map(tag => `<span class="task-tag">#${tag}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
          <div class="task-actions">
            <button class="btn btn-icon edit-task" title="Edit">✏️</button>
            <button class="btn btn-icon duplicate-task" title="Duplicate">📋</button>
            <button class="btn btn-icon delete-task" title="Delete">🗑️</button>
          </div>
        </div>
        ${task.relations && task.relations.length > 0 ? `
          <div class="task-relations">
            <small>Related: ${task.relations.length} task${task.relations.length > 1 ? 's' : ''}</small>
          </div>
        ` : ''}
      </div>
    `;
  }

  setupTaskEventListeners() {
    // Checkbox toggles
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const taskId = e.target.closest('.task-item').dataset.taskId;
        this.app.toggleTask(taskId);
      });
    });

    // Edit buttons
    document.querySelectorAll('.edit-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = e.target.closest('.task-item').dataset.taskId;
        this.editTask(taskId);
      });
    });

    // Delete buttons
    document.querySelectorAll('.delete-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = e.target.closest('.task-item').dataset.taskId;
        this.deleteTask(taskId);
      });
    });

    // Duplicate buttons
    document.querySelectorAll('.duplicate-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = e.target.closest('.task-item').dataset.taskId;
        this.duplicateTask(taskId);
      });
    });

    // Inline title editing
    document.querySelectorAll('.task-title').forEach(title => {
      title.addEventListener('dblclick', (e) => {
        if (e.target.contentEditable === 'true') return;
        this.startInlineEdit(e.target);
      });

      if (title.contentEditable === 'true') {
        title.addEventListener('blur', (e) => this.finishInlineEdit(e.target));
        title.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          }
          if (e.key === 'Escape') {
            this.cancelInlineEdit(e.target);
          }
        });
        // Auto-focus and select text
        title.focus();
        document.execCommand('selectAll');
      }
    });
  }

  startInlineEdit(titleElement) {
    const taskId = titleElement.closest('.task-item').dataset.taskId;
    this.app.editingTaskId = taskId;
    
    titleElement.contentEditable = true;
    titleElement.classList.add('editing');
    titleElement.focus();
    document.execCommand('selectAll');
  }

  finishInlineEdit(titleElement) {
    const taskId = titleElement.closest('.task-item').dataset.taskId;
    const newTitle = titleElement.textContent.trim();
    
    if (newTitle && newTitle !== titleElement.dataset.originalTitle) {
      this.app.updateTask(taskId, { title: newTitle });
    }
    
    this.app.editingTaskId = null;
    titleElement.contentEditable = false;
    titleElement.classList.remove('editing');
  }

  cancelInlineEdit(titleElement) {
    titleElement.textContent = titleElement.dataset.originalTitle;
    titleElement.contentEditable = false;
    titleElement.classList.remove('editing');
    this.app.editingTaskId = null;
    titleElement.blur();
  }

  editTask(taskId) {
    const task = this.app.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    this.currentTask = task;
    this.populateTaskForm(task);
    this.showTaskModal('Edit Task');
  }

  deleteTask(taskId) {
    const task = this.app.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (confirm(`Delete task "${task.title}"?`)) {
      this.app.deleteTask(taskId);
    }
  }

  duplicateTask(taskId) {
    const task = this.app.tasks.find(t => t.id === taskId);
    if (!task) return;

    const duplicatedTask = {
      title: task.title + ' (Copy)',
      description: task.description,
      priority: task.priority,
      tags: [...task.tags],
      dueDate: task.dueDate,
      recurrence: task.recurrence,
      relations: [...task.relations]
    };

    this.app.addTask(duplicatedTask);
  }

  showTaskModal(title = 'Add Task') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('taskModal').classList.add('active');
    document.getElementById('taskTitle').focus();
  }

  hideTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
    this.currentTask = null;
    this.clearTaskForm();
  }

  populateTaskForm(task) {
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description;
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskTags').value = task.tags.join(', ');
    document.getElementById('taskRecurrence').value = task.recurrence || '';
    
    if (task.dueDate) {
      // Convert ISO string to datetime-local format
      const date = new Date(task.dueDate);
      const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);
      document.getElementById('taskDueDate').value = localDateTime;
    } else {
      document.getElementById('taskDueDate').value = '';
    }
    
    this.populateRelationsSelect(task.id);
    
    // Set selected relations
    const relationsSelect = document.getElementById('taskRelations');
    Array.from(relationsSelect.options).forEach(option => {
      option.selected = task.relations.includes(option.value);
    });
  }

  populateRelationsSelect(currentTaskId = null) {
    const relationsSelect = document.getElementById('taskRelations');
    relationsSelect.innerHTML = '';
    
    this.app.tasks
      .filter(task => task.id !== currentTaskId)
      .forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.title;
        relationsSelect.appendChild(option);
      });
  }

  clearTaskForm() {
    document.getElementById('taskForm').reset();
    document.getElementById('taskRelations').innerHTML = '';
  }

  saveTask() {
    const formData = this.getTaskFormData();
    const validation = this.validateTaskForm(formData);
    
    if (!validation.isValid) {
      this.showFormErrors(validation.errors);
      return;
    }

    if (this.currentTask) {
      // Update existing task
      this.app.updateTask(this.currentTask.id, formData);
    } else {
      // Create new task
      this.app.addTask(formData);
    }

    this.hideTaskModal();
  }

  getTaskFormData() {
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const priority = document.getElementById('taskPriority').value;
    const tagsInput = document.getElementById('taskTags').value.trim();
    const dueDateInput = document.getElementById('taskDueDate').value;
    const recurrence = document.getElementById('taskRecurrence').value;
    
    // Parse tags
    const tags = tagsInput
      ? tagsInput.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag)
      : [];
    
    // Parse due date
    const dueDate = dueDateInput ? new Date(dueDateInput).toISOString() : null;
    
    // Get selected relations
    const relationsSelect = document.getElementById('taskRelations');
    const relations = Array.from(relationsSelect.selectedOptions).map(option => option.value);

    return {
      title,
      description,
      priority,
      tags,
      dueDate,
      recurrence,
      relations
    };
  }

  validateTaskForm(data) {
    const errors = [];
    
    if (!data.title) {
      errors.push('Title is required');
    }
    
    if (data.title && data.title.length > 500) {
      errors.push('Title must be less than 500 characters');
    }
    
    if (data.description && data.description.length > 2000) {
      errors.push('Description must be less than 2000 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  showFormErrors(errors) {
    // Simple error display - could be enhanced with better UX
    alert('Please fix the following errors:\n' + errors.join('\n'));
  }

  updateTagFilter() {
    const tagFilter = document.getElementById('tagFilter');
    const currentValue = tagFilter.value;
    
    // Clear current options except "All Tags"
    tagFilter.innerHTML = '<option value="">All Tags</option>';
    
    // Get all unique tags
    const tags = this.app.getAllTags();
    tags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = `#${tag}`;
      tagFilter.appendChild(option);
    });
    
    // Restore previous selection if still valid
    if (tags.includes(currentValue)) {
      tagFilter.value = currentValue;
    }
  }

  updateCounters() {
    const tasks = this.app.tasks;
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.filter(t => !t.completed).length;
    const overdue = tasks.filter(t => t.isOverdue()).length;
    
    // Update document title
    document.title = `Todo PWA${pending > 0 ? ` (${pending} pending)` : ''}`;
  }

  updateFilterUI() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    
    if (searchInput.value) {
      clearBtn.classList.add('visible');
    } else {
      clearBtn.classList.remove('visible');
    }
  }

  updateSortUI() {
    const sortOrderBtn = document.getElementById('sortOrder');
    sortOrderBtn.textContent = this.app.currentSort.order === 'asc' ? '↑' : '↓';
    sortOrderBtn.title = `Sort ${this.app.currentSort.order === 'asc' ? 'Descending' : 'Ascending'}`;
  }

  setupDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('task-item')) {
        this.dragState.dragging = true;
        this.dragState.draggedElement = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
      }
    });

    document.addEventListener('dragend', (e) => {
      if (e.target.classList.contains('task-item')) {
        this.dragState.dragging = false;
        e.target.classList.remove('dragging');
        this.dragState.draggedElement = null;
        
        // Remove placeholder
        if (this.dragState.placeholder) {
          this.dragState.placeholder.remove();
          this.dragState.placeholder = null;
        }
      }
    });

    document.addEventListener('dragover', (e) => {
      if (this.dragState.dragging) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const taskItem = e.target.closest('.task-item');
        if (taskItem && taskItem !== this.dragState.draggedElement) {
          const rect = taskItem.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const isAfter = e.clientY > midY;
          
          this.showDropIndicator(taskItem, isAfter);
        }
      }
    });

    document.addEventListener('drop', (e) => {
      if (this.dragState.dragging) {
        e.preventDefault();
        
        const targetItem = e.target.closest('.task-item');
        if (targetItem && targetItem !== this.dragState.draggedElement) {
          const draggedId = this.dragState.draggedElement.dataset.taskId;
          const targetId = targetItem.dataset.taskId;
          
          const rect = targetItem.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const position = e.clientY > midY ? 'after' : 'before';
          
          this.app.reorderTasks(draggedId, targetId, position);
        }
      }
    });
  }

  showDropIndicator(targetElement, isAfter) {
    // Remove existing placeholder
    if (this.dragState.placeholder) {
      this.dragState.placeholder.remove();
    }
    
    // Create new placeholder
    this.dragState.placeholder = document.createElement('div');
    this.dragState.placeholder.className = 'drop-indicator';
    this.dragState.placeholder.style.cssText = `
      height: 2px;
      background: var(--primary-color);
      margin: 4px 0;
      border-radius: 1px;
    `;
    
    if (isAfter) {
      targetElement.parentNode.insertBefore(this.dragState.placeholder, targetElement.nextSibling);
    } else {
      targetElement.parentNode.insertBefore(this.dragState.placeholder, targetElement);
    }
  }

  closeModals() {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Utility method to show loading states
  showLoading(element, text = 'Loading...') {
    const originalContent = element.innerHTML;
    element.innerHTML = `<div class="loading">${text}</div>`;
    return () => {
      element.innerHTML = originalContent;
    };
  }
}