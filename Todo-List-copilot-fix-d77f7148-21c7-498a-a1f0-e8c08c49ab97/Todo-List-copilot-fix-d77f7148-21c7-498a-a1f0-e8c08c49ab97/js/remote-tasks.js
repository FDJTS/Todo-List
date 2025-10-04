// Remote Task Service for syncing tasks with backend bulk API
// Initial simple implementation: on every save we send all tasks.
// Future optimization: diff tracking & offline queue.
class RemoteTaskService {
  constructor(baseUrl, getAccessToken) {
    this.base = baseUrl.replace(/\/$/, '') + '/api/tasks';
    this.getAccessToken = getAccessToken;
    this.queueKey = 'todo-offline-queue';
    this.queue = this._loadQueue();
    this.flushing = false;
    window.addEventListener('online', ()=> this.flush());
    window.addEventListener('online', ()=> this._emitStatus());
    window.addEventListener('offline', ()=> this._emitStatus());
    this.listeners = { status:[], queue:[] };
    this.status = this._computeStatus();
  }
  _headers() {
    const h = { 'Content-Type':'application/json' };
    const token = this.getAccessToken();
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }
  async fetchAll() {
    const res = await fetch(this.base, { headers: this._headers() });
    if (!res.ok) throw new Error('Remote list failed ' + res.status);
    const arr = await res.json();
    return Array.isArray(arr) ? arr.map(t => this._fromRemote(t)) : [];
  }
  async create(task) {
    if (!navigator.onLine) {
      const tempId = task.id || ('tmp_' + Date.now().toString(36)+Math.random().toString(36).slice(2,6));
      this._enqueue({ op:'create', tempId, data:{ title: task.title, description: task.description||'' } });
      this._emitStatus();
      return { ...task, id: tempId, pending:true };
    }
    const res = await fetch(this.base, { method:'POST', headers: this._headers(), body: JSON.stringify({ title: task.title, description: task.description || '' }) });
    if (!res.ok) throw new Error('Create failed');
    const created = this._fromRemote(await res.json());
    this._emit('created', { tempId: task.id, task: created });
    return created;
  }
  async update(task) {
    if (!navigator.onLine || task.pending) {
      this._enqueue({ op:'update', id: task.id, data:{ title: task.title, description: task.description } });
      return { ...task, dirty:true };
    }
    const res = await fetch(`${this.base}/${task.id}`, { method:'PUT', headers: this._headers(), body: JSON.stringify({ title: task.title, description: task.description }) });
    if (!res.ok) throw new Error('Update failed');
    return this._fromRemote(await res.json());
  }
  async toggle(id) {
    if (!navigator.onLine) {
      this._enqueue({ op:'toggle', id });
      return { id, toggled:true }; // caller will merge state locally
    }
    const res = await fetch(`${this.base}/${id}/toggle`, { method:'POST', headers: this._headers() });
    if (!res.ok) throw new Error('Toggle failed');
    return this._fromRemote(await res.json());
  }
  async remove(id) {
    if (!navigator.onLine) {
      this._enqueue({ op:'delete', id });
      return true;
    }
    const res = await fetch(`${this.base}/${id}`, { method:'DELETE', headers: this._headers() });
    if (res.status === 204) return true;
    if (!res.ok) throw new Error('Delete failed');
    return true;
  }

  _fromRemote(r) { return { id:r.id, title:r.title, description:r.description||'', completed:!!r.completed, createdAt:r.createdAt, updatedAt:r.updatedAt }; }
  _toRemote(task) { return task.toJSON ? task.toJSON() : task; }

  _loadQueue(){
    try { return JSON.parse(localStorage.getItem(this.queueKey)) || []; } catch { return []; }
  }
  _saveQueue(){ try { localStorage.setItem(this.queueKey, JSON.stringify(this.queue)); } catch {} }
  _enqueue(entry){ this.queue.push({ ...entry, ts: Date.now() }); this._saveQueue(); }

  on(event, handler){ if(this.listeners[event]) this.listeners[event].push(handler); }
  _emit(event, payload){ (this.listeners[event]||[]).forEach(fn=> { try { fn(payload); } catch(e){ console.warn(e); } }); }
  _computeStatus(){
    if(!navigator.onLine) return 'offline';
    if(this.flushing) return 'syncing';
    if(this.queue.length) return 'queued';
    return 'idle';
  }
  _emitStatus(){
    const st = this._computeStatus();
    if(st !== this.status){ this.status = st; this._emit('status', st); }
    this._emit('queue', { size: this.queue.length });
  }

  async flush(){
    if (this.flushing || !navigator.onLine || !this.queue.length) { this._emitStatus(); return; }
    this.flushing = true;
    this._emitStatus();
    try {
      const newQueue = [];
      for (const item of this.queue){
        try {
          if (item.op === 'create') {
            const res = await fetch(this.base, { method:'POST', headers:this._headers(), body: JSON.stringify(item.data) });
            if (!res.ok) throw new Error('create fail');
            const created = await res.json();
            this._emit('created', { tempId: item.tempId, task: this._fromRemote(created) });
          } else if (item.op === 'update') {
            await fetch(`${this.base}/${item.id}`, { method:'PUT', headers:this._headers(), body: JSON.stringify(item.data) });
          } else if (item.op === 'toggle') {
            await fetch(`${this.base}/${item.id}/toggle`, { method:'POST', headers:this._headers() });
          } else if (item.op === 'delete') {
            await fetch(`${this.base}/${item.id}`, { method:'DELETE', headers:this._headers() });
          }
        } catch(err){
          // keep item for retry
          newQueue.push(item);
        }
      }
      this.queue = newQueue;
      this._saveQueue();
    } finally { this.flushing = false; }
    this._emitStatus();
  }
}
