// Simple Auth Manager (legacy local-only demo)
// DEPRECATED: Remote auth now handled by RemoteAuthAdapter in auth-adapter.js
// This remains only as fallback when no backend base URL configured.
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.storageKey = 'todo-users';
    this.users = this.loadUsers();
  }

  loadUsers() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey)) || [];
    } catch {
      return [];
    }
  }

  saveUsers() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.users)); } catch {}
  }

  hash(str) {
    // Lightweight hash (NOT cryptographic)
    let h = 0, i, chr;
    if (str.length === 0) return h.toString();
    for (i = 0; i < str.length; i++) {
      chr = str.charCodeAt(i);
      h = (h << 5) - h + chr;
      h |= 0;
    }
    return h.toString(16);
  }

  register(username, password) {
    username = username.trim().toLowerCase();
    if (!username || !password) throw new Error('Username & password required');
    if (this.users.find(u => u.username === username)) throw new Error('User exists');
    const user = { username, pass: this.hash(password), createdAt: Date.now() };
    this.users.push(user);
    this.saveUsers();
    return true;
  }

  login(username, password) {
    username = username.trim().toLowerCase();
    const user = this.users.find(u => u.username === username);
    if (!user) throw new Error('User not found');
    if (user.pass !== this.hash(password)) throw new Error('Invalid credentials');
    this.currentUser = user;
    localStorage.setItem('todo-current-user', user.username);
    return true;
  }

  autoLogin() {
    const saved = localStorage.getItem('todo-current-user');
    if (saved) {
      const user = this.users.find(u => u.username === saved);
      if (user) this.currentUser = user;
    }
    return this.currentUser;
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('todo-current-user');
  }

  getNamespace() {
    return this.currentUser ? `user-${this.currentUser.username}` : 'public';
  }
}
