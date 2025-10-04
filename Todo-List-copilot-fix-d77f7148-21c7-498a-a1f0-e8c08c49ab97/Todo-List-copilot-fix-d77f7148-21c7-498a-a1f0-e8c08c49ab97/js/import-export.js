// Import/Export Manager
class ImportExportManager {
  constructor(app) {
    this.app = app;
    this.version = '3.0';
    this.supportedVersions = ['1.0', '2.0', '3.0'];
  }

  // Export data
  async export(format = 'json') {
    try {
      const data = await this.app.storage.exportData();
      
      switch (format) {
        case 'json':
          this.downloadJSON(data);
          break;
        case 'csv':
          this.downloadCSV(data.tasks);
          break;
        case 'txt':
          this.downloadTXT(data.tasks);
          break;
        case 'md':
          this.downloadMarkdown(data.tasks);
          break;
        case 'ics':
          this.downloadICS(data.tasks);
          break;
        default:
          throw new Error('Unsupported export format');
      }
      
      this.app.notifications.showExportSuccess();
    } catch (error) {
      console.error('Export failed:', error);
      this.app.notifications.error(`Export failed: ${error.message}`);
    }
  }

  showExportChooser() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:420px;">
        <div class="modal-header"><h2>Export Data</h2><button class="btn btn-icon modal-close" aria-label="Close">&times;</button></div>
        <div style="padding:1.25rem 1.5rem 1.75rem;">
          <p style="margin:0 0 1rem; font-size:.85rem; color:var(--text-secondary);">Choose a format to export your tasks.</p>
          <div class="export-grid" style="display:grid; gap:.75rem;">
            ${[
              {fmt:'json',label:'JSON',desc:'Full backup (recommended)'},
              {fmt:'csv',label:'CSV',desc:'Spreadsheet friendly'},
              {fmt:'txt',label:'Plain Text',desc:'Readable text list'},
              {fmt:'md',label:'Markdown',desc:'Notion-style checklist'},
              {fmt:'ics',label:'iCalendar (.ics)',desc:'Calendar events'}
            ].map(f=>`
              <button data-export="${f.fmt}" class="btn btn-secondary" style="justify-content:flex-start;">
                <strong style="min-width:90px;text-align:left;">${f.label}</strong>
                <span style="font-weight:400;color:var(--text-secondary);font-size:.7rem;">${f.desc}</span>
              </button>`).join('')}
          </div>
          <div style="margin-top:1.25rem; text-align:right;">
            <button class="btn btn-primary" data-close>Close</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(()=>modal.classList.add('active'));
    const close = () => { modal.classList.remove('active'); setTimeout(()=>modal.remove(),250); };
    modal.addEventListener('click',(e)=>{
      if (e.target === modal || e.target.dataset.close !== undefined || e.target.classList.contains('modal-close')) close();
      const btn = e.target.closest('[data-export]');
      if (btn) { const fmt = btn.dataset.export; this.export(fmt); close(); }
    });
  }

  downloadJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    this.downloadBlob(blob, `todo-backup-${this.getDateString()}.json`);
  }

  downloadCSV(tasks) {
    const headers = [
      'Title', 'Description', 'Status', 'Priority', 'Tags', 
      'Due Date', 'Recurrence', 'Created At', 'Completed At'
    ];
    
    const rows = tasks.map(task => [
      this.escapeCSV(task.title),
      this.escapeCSV(task.description || ''),
      task.completed ? 'Completed' : 'Pending',
      task.priority,
      task.tags.join(', '),
      task.dueDate ? new Date(task.dueDate).toISOString() : '',
      task.recurrence || '',
      new Date(task.createdAt).toISOString(),
      task.completedAt ? new Date(task.completedAt).toISOString() : ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    this.downloadBlob(blob, `todo-export-${this.getDateString()}.csv`);
  }

  downloadTXT(tasks) {
    const content = tasks.map(task => {
      let text = `${task.completed ? '✓' : '○'} ${task.title}\n`;
      
      if (task.description) {
        text += `  Description: ${task.description}\n`;
      }
      
      if (task.dueDate) {
        text += `  Due: ${new Date(task.dueDate).toLocaleString()}\n`;
      }
      
      if (task.tags.length > 0) {
        text += `  Tags: ${task.tags.map(tag => '#' + tag).join(' ')}\n`;
      }
      
      text += `  Priority: ${task.priority}\n`;
      text += `  Created: ${new Date(task.createdAt).toLocaleDateString()}\n`;
      
      return text;
    }).join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    this.downloadBlob(blob, `todo-list-${this.getDateString()}.txt`);
  }

  downloadMarkdown(tasks) {
    const lines = ['# Todo Export', '', `Export Date: ${new Date().toLocaleString()}`, ''];
    tasks.forEach(t => {
      const title = `- [${t.completed ? 'x' : ' '}] ${t.title}`;
      lines.push(title);
      if (t.description) lines.push(`  - _${t.description.replace(/\n/g,' ')}_`);
      if (t.dueDate) lines.push(`  - Due: ${new Date(t.dueDate).toLocaleString()}`);
      if (t.reminderAt) lines.push(`  - Reminder: ${new Date(t.reminderAt).toLocaleString()}`);
      if (t.tags && t.tags.length) lines.push('  - Tags: ' + t.tags.map(x=>`\`${x}\``).join(', '));
      if (t.priority) lines.push('  - Priority: ' + t.priority);
      if (t.recurrence) lines.push('  - Recurs: ' + t.recurrence);
      if (t.relations && t.relations.length) lines.push(`  - Related: ${t.relations.length} task(s)`);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    this.downloadBlob(blob, `todo-export-${this.getDateString()}.md`);
  }

  downloadICS(tasks) {
    const escapeICal = (str='') => str.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const dtstamp = this.formatICSDate(new Date());
    const events = tasks.filter(t=>t.dueDate || t.reminderAt).map(t => {
      const start = t.reminderAt || t.dueDate;
      const end = t.dueDate || t.reminderAt || start;
      const uid = (t.id || Math.random().toString(36).slice(2)) + '@todo-pwa';
      const summary = escapeICal(t.title);
      const descParts = [];
      if (t.description) descParts.push(t.description);
      if (t.tags && t.tags.length) descParts.push('Tags: '+t.tags.join(', '));
      if (t.priority) descParts.push('Priority: '+t.priority);
      const description = escapeICal(descParts.join('\n'));
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `SUMMARY:${summary}`,
        `DTSTART:${this.formatICSDate(new Date(start))}`,
        `DTEND:${this.formatICSDate(new Date(end))}`,
        description ? `DESCRIPTION:${description}` : null,
        'END:VEVENT'
      ].filter(Boolean).join('\n');
    });
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Todo PWA//EN','CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    this.downloadBlob(blob, `todo-calendar-${this.getDateString()}.ics`);
  }

  formatICSDate(date) {
    const pad = n => String(n).padStart(2,'0');
    return date.getUTCFullYear()+pad(date.getUTCMonth()+1)+pad(date.getUTCDate())+'T'+pad(date.getUTCHours())+pad(date.getUTCMinutes())+pad(date.getUTCSeconds())+'Z';
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  escapeCSV(str) {
    if (typeof str !== 'string') return str;
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  // Import data
  import() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.txt';
    input.multiple = false;

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      this.processImportFile(file);
    });

    input.click();
  }

  async processImportFile(file) {
    try {
      const extension = file.name.split('.').pop().toLowerCase();
      const content = await this.readFile(file);

      let importData;
      switch (extension) {
        case 'json':
          importData = this.parseJSON(content);
          break;
        case 'csv':
          importData = this.parseCSV(content);
          break;
        case 'txt':
          importData = this.parseTXT(content);
          break;
        default:
          throw new Error('Unsupported file format');
      }

      await this.importData(importData);
    } catch (error) {
      console.error('Import failed:', error);
      this.app.notifications.showImportError(error);
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  parseJSON(content) {
    const data = JSON.parse(content);
    
    // Validate format
    if (!data.version) {
      throw new Error('Invalid backup file format - missing version');
    }
    
    if (!this.supportedVersions.includes(data.version)) {
      throw new Error(`Unsupported version: ${data.version}`);
    }
    
    if (!data.tasks || !Array.isArray(data.tasks)) {
      throw new Error('Invalid backup file format - missing or invalid tasks');
    }
    
    return this.migrateData(data);
  }

  parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header and one data row');
    }

    const headers = this.parseCSVRow(lines[0]);
    const tasks = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVRow(lines[i]);
      if (values.length === 0) continue;

      const task = this.csvRowToTask(headers, values);
      if (task) tasks.push(task);
    }

    return {
      version: this.version,
      tasks,
      importType: 'csv'
    };
  }

  parseCSVRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  csvRowToTask(headers, values) {
    const task = {};
    
    for (let i = 0; i < headers.length && i < values.length; i++) {
      const header = headers[i].toLowerCase().trim();
      const value = values[i].trim();
      
      switch (header) {
        case 'title':
          task.title = value;
          break;
        case 'description':
          task.description = value;
          break;
        case 'status':
          task.completed = value.toLowerCase() === 'completed';
          break;
        case 'priority':
          task.priority = ['low', 'medium', 'high'].includes(value.toLowerCase()) 
            ? value.toLowerCase() : 'medium';
          break;
        case 'tags':
          task.tags = value ? value.split(',').map(tag => tag.trim().toLowerCase()) : [];
          break;
        case 'due date':
          task.dueDate = value ? new Date(value).toISOString() : null;
          break;
        case 'recurrence':
          task.recurrence = value || null;
          break;
        case 'created at':
          task.createdAt = value ? new Date(value).toISOString() : new Date().toISOString();
          break;
        case 'completed at':
          task.completedAt = value ? new Date(value).toISOString() : null;
          break;
      }
    }

    // Validate required fields
    if (!task.title) return null;

    return task;
  }

  parseTXT(content) {
    const tasks = [];
    const sections = content.split(/\n?---\n?\n?/).filter(s => s.trim());

    sections.forEach(section => {
      const task = this.txtSectionToTask(section);
      if (task) tasks.push(task);
    });

    return {
      version: this.version,
      tasks,
      importType: 'txt'
    };
  }

  txtSectionToTask(section) {
    const lines = section.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length === 0) return null;

    const task = {
      tags: [],
      priority: 'medium',
      completed: false,
      createdAt: new Date().toISOString()
    };

    // First line is the title with status
    const titleLine = lines[0];
    if (titleLine.startsWith('✓')) {
      task.completed = true;
      task.title = titleLine.substring(1).trim();
    } else if (titleLine.startsWith('○')) {
      task.title = titleLine.substring(1).trim();
    } else {
      task.title = titleLine;
    }

    // Parse other lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('Description:')) {
        task.description = line.substring(12).trim();
      } else if (line.startsWith('Due:')) {
        const dateStr = line.substring(4).trim();
        try {
          task.dueDate = new Date(dateStr).toISOString();
        } catch {
          // Invalid date, skip
        }
      } else if (line.startsWith('Tags:')) {
        const tagsStr = line.substring(5).trim();
        task.tags = tagsStr.split(' ')
          .filter(tag => tag.startsWith('#'))
          .map(tag => tag.substring(1).toLowerCase());
      } else if (line.startsWith('Priority:')) {
        const priority = line.substring(9).trim().toLowerCase();
        if (['low', 'medium', 'high'].includes(priority)) {
          task.priority = priority;
        }
      } else if (line.startsWith('Created:')) {
        const dateStr = line.substring(8).trim();
        try {
          task.createdAt = new Date(dateStr).toISOString();
        } catch {
          // Invalid date, use current
        }
      }
    }

    return task.title ? task : null;
  }

  migrateData(data) {
    // Handle version migrations
    switch (data.version) {
      case '1.0':
        data = this.migrateFromV1(data);
        // Fall through
      case '2.0':
        data = this.migrateFromV2(data);
        // Fall through
      case '3.0':
        return data; // Current version
      default:
        throw new Error(`Unsupported version: ${data.version}`);
    }
  }

  migrateFromV1(data) {
    // V1 to V2 migration
    data.tasks = data.tasks.map(task => ({
      ...task,
      relations: task.relations || [],
      recurrence: task.recurrence || null,
      notifiedOverdue: false
    }));
    
    data.version = '2.0';
    return data;
  }

  migrateFromV2(data) {
    // V2 to V3 migration
    data.settings = data.settings || {};
    data.metadata = data.metadata || this.generateMetadata(data.tasks);
    data.version = '3.0';
    return data;
  }

  generateMetadata(tasks) {
    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.completed).length,
      tags: [...new Set(tasks.flatMap(t => t.tags || []))]
    };
  }

  async importData(importData) {
    // Basic structural validation before proceeding (non exhaustive)
    const validation = this.validateSchema(importData);
    if (!validation.valid) {
      throw new Error('Import validation failed: ' + validation.errors.join('; '));
    }
    // Perform dry run diff analysis
    const analysis = this.dryRunAnalyze(importData.tasks);
    this.app.notifications.showImportDryRun(analysis.summary);

    const mergeMode = await this.askMergeMode(importData, analysis);
    
    if (mergeMode === 'cancel') return;

    this.app.undoRedo.saveState();

    try {
      if (mergeMode === 'replace') {
        // Replace all tasks
        this.app.tasks = importData.tasks.map(taskData => new Task(taskData));
      } else {
        // Merge tasks
        const existingIds = new Set(this.app.tasks.map(t => t.id));
        const newTasks = importData.tasks
          .filter(taskData => !existingIds.has(taskData.id))
          .map(taskData => new Task(taskData));
        
        this.app.tasks.unshift(...newTasks);
      }

      // Import settings if available
      if (importData.settings) {
        await this.importSettings(importData.settings);
      }

      await this.app.saveTasks();
      this.app.ui.render();

      const importedCount = importData.tasks.length;
      this.app.notifications.showImportSuccess(importedCount);

    } catch (error) {
      // Rollback on error
      this.app.undoRedo.undo();
      throw error;
    }
  }

  askMergeMode(importData, analysis) {
    return new Promise((resolve) => {
      const modal = this.createImportDialog(importData, analysis, resolve);
      document.body.appendChild(modal);
      
      requestAnimationFrame(() => {
        modal.classList.add('active');
      });
    });
  }

  createImportDialog(importData, analysis, callback) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '2000';

    const tasksCount = importData.tasks.length;
    const existingCount = this.app.tasks.length;
    const add = analysis.summary.add;
    const duplicate = analysis.summary.duplicate;
    const invalid = analysis.summary.invalid;

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h2>Import Tasks</h2>
        </div>
        <div style="padding: 1.5rem;">
          <p>Found ${tasksCount} task(s) to import.</p>
          <p>You currently have ${existingCount} task(s).</p>
          <div style="margin:1rem 0; padding:.75rem; background:var(--bg-secondary); border-radius:var(--border-radius); font-size:.75rem; line-height:1.4;">
            <strong>Analysis:</strong><br>
            + ${add} new task(s)<br>
            = ${duplicate} duplicate (will be skipped in merge)<br>
            ! ${invalid} invalid (quarantined on import)
          </div>
          
          <div style="margin: 1.5rem 0;">
            <p><strong>How would you like to import?</strong></p>
            
            <div style="margin-top: 1rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                <input type="radio" name="importMode" value="merge" checked>
                <span>Merge - Add new tasks, keep existing ones</span>
              </label>
              
              <label style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="radio" name="importMode" value="replace">
                <span>Replace - Remove all existing tasks and import new ones</span>
              </label>
            </div>
          </div>
          
          ${importData.metadata ? `
            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--border-radius); margin: 1rem 0;">
              <h4 style="margin: 0 0 0.5rem 0;">Import Details:</h4>
              <ul style="margin: 0; padding-left: 1.5rem;">
                <li>Format: ${importData.importType || 'JSON'}</li>
                <li>Version: ${importData.version}</li>
                <li>Export Date: ${importData.exportDate ? new Date(importData.exportDate).toLocaleDateString() : 'Unknown'}</li>
                ${importData.metadata.tags ? `<li>Tags: ${importData.metadata.tags.length}</li>` : ''}
              </ul>
            </div>
          ` : ''}
          <button class="btn btn-secondary" data-preview-invalid style="margin-top:.25rem; ${invalid ? '' : 'display:none;'}">Review Invalid (${invalid})</button>
          
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 2rem;">
            <button class="btn btn-secondary import-cancel">Cancel</button>
            <button class="btn btn-primary import-confirm">Import</button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('import-cancel')) {
        callback('cancel');
        this.closeModal(modal);
      } else if (e.target.classList.contains('import-confirm')) {
        const mode = modal.querySelector('input[name="importMode"]:checked').value;
        callback(mode);
        this.closeModal(modal);
      } else if (e.target === modal) {
        callback('cancel');
        this.closeModal(modal);
      } else if (e.target.dataset.previewInvalid !== undefined) {
        this.showInvalidPreview(analysis.invalidSamples);
      }
    });

    return modal;
  }

  closeModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
  }

  async importSettings(settings) {
    // Import theme settings
    if (settings.theme && this.app.themes) {
      this.app.themes.importThemeSettings({
        currentTheme: settings.theme,
        autoTheme: settings.autoTheme
      });
    }

    // Import other settings
    for (const [key, value] of Object.entries(settings)) {
      if (key !== 'theme' && key !== 'autoTheme') {
        await this.app.storage.setSetting(key, value);
      }
    }
  }

  // Backup and sync features
  async createAutoBackup() {
    try {
      const data = await this.app.storage.exportData();
      const backup = {
        ...data,
        autoBackup: true,
        timestamp: Date.now()
      };

      // Store in localStorage as emergency backup
      const backups = JSON.parse(localStorage.getItem('todo-auto-backups') || '[]');
      backups.unshift(backup);
      
      // Keep only last 5 auto backups
      if (backups.length > 5) {
        backups.splice(5);
      }

      localStorage.setItem('todo-auto-backups', JSON.stringify(backups));
      return true;
    } catch (error) {
      console.warn('Auto backup failed:', error);
      return false;
    }
  }

  getAutoBackups() {
    try {
      return JSON.parse(localStorage.getItem('todo-auto-backups') || '[]');
    } catch {
      return [];
    }
  }

  restoreFromAutoBackup(timestamp) {
    const backups = this.getAutoBackups();
    const backup = backups.find(b => b.timestamp === timestamp);
    
    if (!backup) {
      throw new Error('Backup not found');
    }

    return this.importData(backup);
  }

  // Export utilities
  getExportStats() {
    return {
      version: this.version,
      supportedFormats: ['json', 'csv', 'txt', 'md', 'ics'],
      supportedVersions: this.supportedVersions,
      lastExport: localStorage.getItem('todo-last-export'),
      autoBackupsCount: this.getAutoBackups().length
    };
  }

  // Lightweight schema validation (avoid heavy libs). Checks first few tasks.
  validateSchema(data) {
    const errors = [];
    if (!data || typeof data !== 'object') {
      errors.push('Data root must be object');
      return { valid: false, errors };
    }
    if (!Array.isArray(data.tasks)) {
      errors.push('tasks must be an array');
    } else {
      data.tasks.slice(0, 10).forEach((t, i) => {
        if (!t || typeof t !== 'object') {
          errors.push(`Task[${i}] not object`); return;
        }
        if (typeof t.title !== 'string' || !t.title.trim()) {
          errors.push(`Task[${i}] missing title`);
        }
        if (t.tags && !Array.isArray(t.tags)) {
          errors.push(`Task[${i}] tags not array`);
        }
        if (t.priority && !['low','medium','high'].includes(t.priority)) {
          errors.push(`Task[${i}] invalid priority`);
        }
        if (t.dueDate && isNaN(Date.parse(t.dueDate))) {
          errors.push(`Task[${i}] invalid dueDate`);
        }
      });
    }
    return { valid: errors.length === 0, errors };
  }

  // Dry run: categorize tasks vs existing tasks & validate
  dryRunAnalyze(importTasks) {
    const existingIds = new Set(this.app.tasks.map(t => t.id));
    let add = 0, duplicate = 0, invalid = 0;
    const invalidSamples = [];
    importTasks.forEach(t => {
      try {
        const candidate = new Task(t);
        const { isValid, errors } = candidate.validate();
        if (!isValid) {
          invalid++; if (invalidSamples.length < 10) invalidSamples.push({ task: t, errors }); return;
        }
        if (existingIds.has(candidate.id)) duplicate++; else add++;
      } catch (e) {
        invalid++; if (invalidSamples.length < 10) invalidSamples.push({ task: t, errors: ['Exception: ' + e.message] });
      }
    });
    return { summary: { add, duplicate, invalid }, invalidSamples };
  }

  showInvalidPreview(samples) {
    if (!samples.length) return;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:600px; max-height:70vh; overflow:auto;">
        <div class="modal-header"><h2>Invalid Tasks (${samples.length})</h2><button class="btn btn-icon modal-close" aria-label="Close">&times;</button></div>
        <div style="padding:1rem; font-size:.75rem; line-height:1.3;">
          <p>The following sample tasks were rejected during validation. They are quarantined and not imported.</p>
          <div style="display:flex; flex-direction:column; gap:.75rem;">
            ${samples.map(s=>`<div style="background:var(--bg-secondary); padding:.5rem .75rem; border-radius:var(--border-radius);">
              <code style="display:block; white-space:pre; overflow:auto; max-height:120px;">${this.escapeHTML(JSON.stringify(s.task,null,2))}</code>
              <div style="color:var(--warning); margin-top:.25rem;">Errors: ${s.errors.join(', ')}</div>
            </div>`).join('')}
          </div>
          <div style="text-align:right; margin-top:1rem;"><button class="btn btn-primary" data-close-invalid>Close</button></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(()=>modal.classList.add('active'));
    const close=()=>{modal.classList.remove('active'); setTimeout(()=>modal.remove(),250);};
    modal.addEventListener('click',e=>{ if(e.target===modal|| e.target.dataset.closeInvalid!==undefined || e.target.classList.contains('modal-close')) close(); });
  }

  escapeHTML(str='') {
    return str.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
}

// Auto backup on page unload
window.addEventListener('beforeunload', () => {
  if (window.todoApp && window.todoApp.importExport) {
    window.todoApp.importExport.createAutoBackup();
  }
});