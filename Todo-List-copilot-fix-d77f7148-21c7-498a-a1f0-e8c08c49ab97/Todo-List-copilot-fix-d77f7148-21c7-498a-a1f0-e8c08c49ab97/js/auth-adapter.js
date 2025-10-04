// Auth Adapter Abstraction
// This creates a pluggable layer so we can later swap a real secure backend auth
// without touching the rest of the app logic. For now we keep a local demo adapter.

class AuthAdapter {
  // Events: 'login', 'logout'
  constructor() {
    this.listeners = { login: [], logout: [] };
  }
  async login(username, password) { throw new Error('Not implemented'); }
  async signup(username, password) { throw new Error('Not implemented'); }
  async logout() { throw new Error('Not implemented'); }
  getCurrentUser() { return null; }
  on(event, handler) { if (this.listeners[event]) this.listeners[event].push(handler); }
  emit(event, payload) { (this.listeners[event] || []).forEach(h => { try { h(payload); } catch(e){ console.warn(e);} }); }
  getNamespace() { return 'public'; }
}

// Local demo adapter (NOT secure - placeholder only)
class LocalDemoAuthAdapter extends AuthAdapter {
  constructor() {
    super();
    this.storageKey = 'todo-users';
    this.currentUser = null;
    this.users = this.loadUsers();
    this.autoLogin();
  }
  loadUsers() {
    try { return JSON.parse(localStorage.getItem(this.storageKey)) || []; } catch { return []; }
  }
  saveUsers() { try { localStorage.setItem(this.storageKey, JSON.stringify(this.users)); } catch {}
  }
  hash(str) {
    let h = 0; for (let i=0;i<str.length;i++){ h = (h<<5)-h + str.charCodeAt(i); h|=0; } return h.toString(16);
  }
  async signup(username, password) {
    username = (username||'').trim().toLowerCase();
    if (!username || !password) throw new Error('Username & password required');
    if (this.users.find(u=>u.username===username)) throw new Error('User exists');
    const user = { username, pass: this.hash(password), createdAt: Date.now() };
    this.users.push(user); this.saveUsers();
    return true;
  }
  async login(username, password) {
    username = (username||'').trim().toLowerCase();
    const user = this.users.find(u=>u.username===username);
    if (!user) throw new Error('User not found');
    if (user.pass !== this.hash(password)) throw new Error('Invalid credentials');
    this.currentUser = user;
    localStorage.setItem('todo-current-user', user.username);
    this.emit('login', user);
    return user;
  }
  autoLogin() {
    const saved = localStorage.getItem('todo-current-user');
    if (saved) {
      const user = this.users.find(u=>u.username===saved);
      if (user) { this.currentUser = user; this.emit('login', user); }
    }
    return this.currentUser;
  }
  async logout() {
    this.currentUser = null; localStorage.removeItem('todo-current-user'); this.emit('logout');
  }
  getCurrentUser() { return this.currentUser; }
  getNamespace() { return this.currentUser ? `user-${this.currentUser.username}` : 'public'; }
}

// Simple factory (later can decide by config)
class AuthService {
  constructor() {
    // If backend base URL configured use remote adapter, else fallback
    if (window.TODO_API_BASE) {
      this.adapter = new RemoteAuthAdapter(window.TODO_API_BASE);
    } else {
      this.adapter = new LocalDemoAuthAdapter();
    }
    // Guest session cookie ensures persistence until cookies cleared
    this.ensureGuestSession();
  }
  ensureGuestSession() {
    if (this.adapter instanceof LocalDemoAuthAdapter && !this.adapter.getCurrentUser()) {
      const existing = document.cookie.split(';').map(s=>s.trim()).find(c=>c.startsWith('guest_session='));
      if (!existing) {
        const id = 'g_' + Math.random().toString(36).slice(2,10);
        document.cookie = `guest_session=${id}; Path=/; SameSite=Lax`;
      }
      // namespace uses guest cookie if present
      const guest = document.cookie.split(';').map(s=>s.trim()).find(c=>c.startsWith('guest_session='));
      if (guest) {
        const val = guest.split('=')[1];
        this.adapter.getNamespace = ()=> 'guest-' + val;
      }
    }
  }
  get user() { return this.adapter.getCurrentUser(); }
  on(event, handler) { this.adapter.on(event, handler); }
  login(u,p){ return this.adapter.login(u,p); }
  signup(u,p){ return this.adapter.signup(u,p); }
  logout(){ return this.adapter.logout(); }
  namespace(){ return this.adapter.getNamespace(); }
}

// Remote adapter (Rust backend Axum API)
class RemoteAuthAdapter extends AuthAdapter {
  constructor(baseUrl) {
    super();
    this.base = baseUrl.replace(/\/$/, '');
    this.currentUser = null;
    this.accessToken = null;
    this.refreshInProgress = false;
    // attempt restore token
    const stored = localStorage.getItem('todo-remote-token');
    const storedUser = localStorage.getItem('todo-remote-username');
    if (stored && storedUser) {
      this.accessToken = stored;
      this.currentUser = { username: storedUser };
      this.emit('login', this.currentUser);
    }
    // try cookie-based session introspection if no token
    if (!this.currentUser) {
      this.tryRestoreFromSession();
    }
  }

  async tryRestoreFromSession(){
    try {
      const me = await this._request('/auth/me','GET',null,false,false);
      if (me && me.userId) {
        const uname = me.username || me.userId;
        this.currentUser = { username: uname };
        localStorage.setItem('todo-remote-username', uname);
        this.emit('login', this.currentUser);
      }
    } catch { /* silent */ }
  }

  async signup(username, password) {
    const body = { username, password };
    await this._request('/auth/register', 'POST', body, false);
    return true;
  }

  async login(username, password) {
    const body = { username, password };
    const data = await this._request('/auth/login', 'POST', body, false);
    if (data && data.token) {
      this.accessToken = data.token;
      this.currentUser = { username: username.toLowerCase() };
      localStorage.setItem('todo-remote-token', this.accessToken);
      localStorage.setItem('todo-remote-username', this.currentUser.username);
      this.emit('login', this.currentUser);
      return this.currentUser;
    }
    throw new Error('Login failed');
  }

  async logout() {
    this.accessToken = null;
    localStorage.removeItem('todo-remote-token');
    localStorage.removeItem('todo-remote-username');
    try { await this._request('/auth/logout','POST',null,false,false); } catch {}
    const user = this.currentUser;
    this.currentUser = null;
    this.emit('logout', user);
  }

  getCurrentUser() { return this.currentUser; }
  getNamespace() { return this.currentUser ? `user-${this.currentUser.username}` : 'public'; }

  async _request(path, method='GET', body=null, auth=true, retry=true) {
    const headers = { 'Content-Type':'application/json' };
    if (auth && this.accessToken) headers['Authorization'] = 'Bearer ' + this.accessToken;
    let res = await fetch(this.base + path, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
      // attempt refresh
      try {
        const r = await fetch(this.base + '/auth/refresh', { method:'POST', credentials:'include' });
        if (r.ok) {
          const data = await r.json();
            if (data && data.token) {
              this.accessToken = data.token;
              localStorage.setItem('todo-remote-token', data.token);
              // retry original
              headers['Authorization'] = 'Bearer ' + data.token;
              res = await fetch(this.base + path, {
                method, headers, credentials:'include', body: body ? JSON.stringify(body) : undefined
              });
            }
        }
      } catch {}
    }
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); if (j && (j.message || j.error)) msg = j.message || j.error; } catch {}
      throw new Error(msg);
    }
    try { return await res.json(); } catch { return null; }
  }
}
