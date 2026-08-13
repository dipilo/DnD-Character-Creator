// Cache helper for frequently accessed but relatively static data
function setCache(req, res, next) {
  // Cache for 30 seconds for API responses that don't change frequently
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=30');
  }
  next();
}

// Simple in-memory cache for expensive queries
const queryCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCachedQuery(key, queryFn) {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = queryFn();
  queryCache.set(key, { data, timestamp: Date.now() });
  
  // Clean old entries periodically
  if (queryCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of queryCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        queryCache.delete(k);
      }
    }
  }
  
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
  // Clean old entries periodically
  if (queryCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of queryCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        queryCache.delete(k);
      }
    }
  }
  return data;
}

module.exports = { setCache, getCachedQuery, getCachedQueryAsync };
