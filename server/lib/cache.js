// Cache helper for frequently accessed but relatively static data

/**
 * A list whose answer changes the moment somebody claims a seat is not a shared-cacheable one:
 * `public, max-age=30` let a browser keep showing the seat the caller had just taken. Private and
 * short is what these routes actually are.
 */
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

/**
 * Drop every entry whose key starts with `prefix`. A write that changes what a cached read answers
 * has to say so: claiming a seat left `unclaimed_players_<id>` standing for another 30 seconds, so
 * the seat the caller had just taken was still offered to them.
 */
function invalidateCache(prefix) {
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) queryCache.delete(key);
  }
}

module.exports = { setCache, getCachedQuery, getCachedQueryAsync, invalidateCache };
