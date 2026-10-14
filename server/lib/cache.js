// Cache helper for frequently accessed but relatively static data

/** Private and short: a shared cache kept showing the seat the caller had just taken. */
function setCache(req, res, next) {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'private, max-age=5');
  }
  next();
}

// Simple in-memory cache for expensive queries
const queryCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function pruneCache() {
  if (queryCache.size <= 100) return;
  const now = Date.now();
  for (const [k, v] of queryCache.entries()) {
    if (now - v.timestamp > CACHE_TTL) queryCache.delete(k);
  }
}

function getCachedQuery(key, queryFn) {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = queryFn();
  queryCache.set(key, { data, timestamp: Date.now() });
  pruneCache();
  return data;
}

// Async variant for DB-backed queries
async function getCachedQueryAsync(key, queryFn) {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = await queryFn();
  queryCache.set(key, { data, timestamp: Date.now() });
  pruneCache();
  return data;
}

/** A write that changes a cached read has to say so, or the seat is offered again. */
function invalidateCache(prefix) {
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) queryCache.delete(key);
  }
}

module.exports = { setCache, getCachedQuery, getCachedQueryAsync, invalidateCache };
