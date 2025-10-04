import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || JWT_SECRET + '-refresh';
const TOKEN_EXPIRE_HOURS = parseInt(process.env.TOKEN_EXPIRE_HOURS || '24',10);
const REFRESH_EXPIRE_DAYS = parseInt(process.env.REFRESH_EXPIRE_DAYS || '30',10);

export async function hashPassword(pw){ return bcrypt.hash(pw, 10); }
export async function comparePassword(hash, pw){ return bcrypt.compare(pw, hash); }
export function signToken(userId){ return jwt.sign({ sub:userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRE_HOURS+'h' }); }
export function verifyToken(token){ return jwt.verify(token, JWT_SECRET); }
export function signRefreshToken(userId){ return jwt.sign({ sub:userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRE_DAYS+'d' }); }
export function verifyRefreshToken(token){ return jwt.verify(token, REFRESH_SECRET); }

export function authMiddleware(req,res,next){
  let token = null;
  const h = req.headers.authorization || '';
  if(h.startsWith('Bearer ')) token = h.slice(7);
  // fallback to cookie
  if(!token && req.cookies && req.cookies['todo_token']) token = req.cookies['todo_token'];
  if(!token) return res.status(401).json({ error:'no token' });
  try { const decoded = verifyToken(token); req.userId = decoded.sub; next(); }
  catch { return res.status(401).json({ error:'invalid token' }); }
}
