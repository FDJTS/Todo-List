import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import { rateLimiter } from './rate-limit.js';
import { hashPassword, comparePassword, signToken, authMiddleware, signRefreshToken, verifyRefreshToken } from './auth.js';
import { createUser, findUserByUsername, listTasks, createTask, getTask, updateTask, deleteTask, findUserById } from './storage.js';

dotenv.config();

const app = express();
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: (origin,cb)=> {
  if(ALLOW_ORIGIN==='*') return cb(null, true);
  if(!origin) return cb(null, true); // non-browser
  if(ALLOW_ORIGIN.split(',').map(s=>s.trim()).includes(origin)) return cb(null, true);
  return cb(new Error('CORS blocked')); }, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // x-www-form-urlencoded
const upload = multer(); // for multipart/form-data
app.use(morgan('dev'));
app.use(cookieParser());

app.get('/health', (_,res)=>res.send('ok'));

function extractCreds(req){
  const src = req.body || {};
  // accept variants Username/username / Password/password
  const username = src.username || src.Username || src.USERNAME;
  const password = src.password || src.Password || src.PASSWORD;
  return { username, password };
}

function cookieOptions(){
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: (parseInt(process.env.TOKEN_EXPIRE_HOURS || '24',10)) * 3600 * 1000
  };
}

function setAuthCookie(res, token, refresh){
  res.cookie('todo_token', token, cookieOptions());
  if(refresh){
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('todo_refresh', refresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: (parseInt(process.env.REFRESH_EXPIRE_DAYS || '30',10))*24*3600*1000
    });
  }
}

app.post('/auth/register', rateLimiter({ max:5 }), upload.none(), async (req,res)=>{
  try {
    const { username, password } = extractCreds(req);
    if(!username || !password) return res.status(400).json({ error:'missing fields' });
    if(password.length < 6) return res.status(400).json({ error:'password too short' });
    const existing = await findUserByUsername(username);
    if(existing) return res.status(409).json({ error:'username exists' });
    const hash = await hashPassword(password);
    await createUser(username, hash);
    // auto-login after register
    const user = await findUserByUsername(username);
  const token = signToken(user.id);
  const refresh = signRefreshToken(user.id);
  setAuthCookie(res, token, refresh);
  res.status(201).json({ status:'created', token });
  } catch (e) { res.status(500).json({ error:e.message }); }
});

app.post('/auth/login', rateLimiter({ max:10 }), upload.none(), async (req,res)=>{
  try {
    const { username, password } = extractCreds(req);
    const user = await findUserByUsername(username);
    if(!user) return res.status(401).json({ error:'invalid credentials' });
    const ok = await comparePassword(user.hash, password);
    if(!ok) return res.status(401).json({ error:'invalid credentials' });
    const token = signToken(user.id);
    const refresh = signRefreshToken(user.id);
    setAuthCookie(res, token, refresh);
    res.json({ token });
  } catch (e) { res.status(500).json({ error:e.message }); }
});

// Session introspection
app.get('/auth/me', authMiddleware, async (req,res)=>{
  const user = await findUserById(req.userId);
  res.json({ userId: req.userId, username: user ? user.username : null });
});

app.post('/auth/logout', (req,res)=>{
  res.clearCookie('todo_token', { path:'/' });
  res.clearCookie('todo_refresh', { path:'/' });
  res.status(204).end();
});

app.post('/auth/refresh', rateLimiter({ max:20 }), async (req,res)=>{
  try {
    const token = req.cookies ? req.cookies['todo_refresh'] : null;
    if(!token) return res.status(401).json({ error:'no refresh' });
    const decoded = verifyRefreshToken(token);
    const access = signToken(decoded.sub);
    setAuthCookie(res, access); // keep old refresh until rotation strategy implemented
    res.json({ token: access });
  } catch { return res.status(401).json({ error:'invalid refresh' }); }
});

// Tasks (protected)
app.get('/api/tasks', authMiddleware, async (req,res)=>{ res.json(await listTasks(req.userId)); });
app.post('/api/tasks', authMiddleware, async (req,res)=>{
  const { title, description='' } = req.body;
  if(!title) return res.status(400).json({ error:'title required' });
  const task = await createTask(req.userId, title, description);
  res.status(201).json(task);
});
app.get('/api/tasks/:id', authMiddleware, async (req,res)=>{
  const t = await getTask(req.userId, req.params.id); if(!t) return res.status(404).json({ error:'not found' }); res.json(t);
});
app.put('/api/tasks/:id', authMiddleware, async (req,res)=>{
  const t = await updateTask(req.userId, req.params.id, req.body); if(!t) return res.status(404).json({ error:'not found' }); res.json(t);
});
app.post('/api/tasks/:id/toggle', authMiddleware, async (req,res)=>{
  const t = await getTask(req.userId, req.params.id); if(!t) return res.status(404).json({ error:'not found' });
  const updated = await updateTask(req.userId, req.params.id, { completed: !t.completed });
  res.json(updated);
});
app.delete('/api/tasks/:id', authMiddleware, async (req,res)=>{
  const ok = await deleteTask(req.userId, req.params.id); if(!ok) return res.status(404).json({ error:'not found' }); res.status(204).end();
});

// Export tasks (JSON download)
app.get('/export', authMiddleware, async (req,res)=>{
  const tasks = await listTasks(req.userId);
  res.setHeader('Content-Disposition', 'attachment; filename="tasks.json"');
  res.json(tasks);
});

// Import tasks (expects JSON array of {title, description, completed?})
app.post('/import', authMiddleware, async (req,res)=>{
  const body = req.body;
  if(!Array.isArray(body)) return res.status(400).json({ error:'expected JSON array' });
  const created = [];
  for(const item of body){
    if(!item.title) continue;
    const task = await createTask(req.userId, item.title, item.description || '');
    if(item.completed) await updateTask(req.userId, task.id, { completed:true });
    created.push(task);
  }
  res.status(201).json({ imported: created.length });
});

const PORT = process.env.PORT || 8080;
if(!process.env.JWT_SECRET) console.warn('[WARN] JWT_SECRET not set; using insecure default');
const server = app.listen(PORT, ()=> console.log('Node API listening on :'+PORT));

// Graceful shutdown
function shutdown(){
  console.log('\nShutting down...');
  server.close(()=>{ console.log('HTTP server closed'); process.exit(0); });
  // force exit after 5s
  setTimeout(()=>{ console.error('Force exit'); process.exit(1); }, 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
