// Simple in-memory rate limiter (fixed window)
// NOTE: For production scale deploy a shared store (Redis) to avoid per-instance bypass.
import crypto from 'crypto';

const buckets = new Map();

export function rateLimiter(options = {}) {
  const windowMs = options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000',10); // 1 min default
  const max = options.max || parseInt(process.env.RATE_LIMIT_MAX || '10',10); // 10 reqs / window default
  const keyFn = options.key || ((req)=> req.ip || req.headers['x-forwarded-for'] || 'global');

  return function(req,res,next){
    const now = Date.now();
    const windowStart = now - windowMs;
    const key = keyFn(req) + ':' + req.path;
    let arr = buckets.get(key);
    if (!arr) { arr = []; buckets.set(key, arr); }
    // prune
    while (arr.length && arr[0] < windowStart) arr.shift();
    if (arr.length >= max) {
      const retry = windowMs - (now - arr[0]);
      res.setHeader('Retry-After', Math.ceil(retry/1000));
      return res.status(429).json({ error:'rate_limited', windowMs, max });
    }
    arr.push(now);
    next();
  };
}

// Optional helper to randomize key (to test collisions)
export function randomKey(){ return crypto.randomBytes(4).toString('hex'); }
