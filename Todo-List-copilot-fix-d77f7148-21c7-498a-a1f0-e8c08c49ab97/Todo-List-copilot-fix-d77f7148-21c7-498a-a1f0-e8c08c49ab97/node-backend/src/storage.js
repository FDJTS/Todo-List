import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

async function ensureDir() { await fs.mkdir(DATA_DIR, { recursive: true }); }
async function load(file) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return []; } }
async function save(file, data) { await ensureDir(); await fs.writeFile(file, JSON.stringify(data, null, 2)); }

export async function createUser(username, hash) {
  const users = await load(USERS_FILE);
  if (users.find(u => u.username === username)) throw new Error('username exists');
  const user = { id: Date.now().toString(36)+Math.random().toString(36).slice(2,8), username, hash, createdAt: new Date().toISOString() };
  users.push(user); await save(USERS_FILE, users); return user;
}
export async function findUserByUsername(username) {
  const users = await load(USERS_FILE); return users.find(u => u.username === username) || null;
}
export async function findUserById(id) {
  const users = await load(USERS_FILE); return users.find(u => u.id === id) || null;
}

export async function listTasks(userId) {
  const tasks = await load(TASKS_FILE); return tasks.filter(t => t.userId === userId);
}
export async function createTask(userId, title, description='') {
  const tasks = await load(TASKS_FILE);
  const task = { id: Date.now().toString(36)+Math.random().toString(36).slice(2,8), userId, title, description, completed:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
  tasks.push(task); await save(TASKS_FILE, tasks); return task;
}
export async function getTask(userId, id) { const tasks = await load(TASKS_FILE); return tasks.find(t => t.userId===userId && t.id===id) || null; }
export async function updateTask(userId, id, data) {
  const tasks = await load(TASKS_FILE);
  const idx = tasks.findIndex(t => t.userId===userId && t.id===id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...data, updatedAt:new Date().toISOString() };
  await save(TASKS_FILE, tasks); return tasks[idx];
}
export async function deleteTask(userId, id) {
  const tasks = await load(TASKS_FILE);
  const idx = tasks.findIndex(t => t.userId===userId && t.id===id);
  if (idx === -1) return false;
  tasks.splice(idx,1); await save(TASKS_FILE, tasks); return true;
}
