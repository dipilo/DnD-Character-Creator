// server/server.js
//
// Entry point. Everything below the middleware stack used to live in this file as ~3100 lines
// of route handlers; MERGE_PLAN.md Phase 1a moved them into routes/, middleware/, lib/ and db/
// without changing behaviour. Routers keep their full paths and are mounted at the root, so the
// registration order here is the same order the routes were declared in before the split.
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { ensureSchema } = require('./db/schema');
const { config } = require('./config');
const { mountStaticClient } = require('./staticClient');

const authRoutes = require('./routes/auth');
const systemRoutes = require('./routes/system');
const feedbackRoutes = require('./routes/feedback');
const syncRoutes = require('./routes/sync');
const playersRoutes = require('./routes/players');
const campaignsRoutes = require('./routes/campaigns');
const invitesRoutes = require('./routes/invites');
const groupsRoutes = require('./routes/groups');
const usersRoutes = require('./routes/users');
const availabilityRoutes = require('./routes/availability');
const runtimeRoutes = require('./routes/runtime');
const charactersRoutes = require('./routes/characters');

const app = express();
// Behind a reverse proxy (Render, Vercel, etc.), trust the first proxy hop
// Using 1 avoids a permissive setting that can break express-rate-limit
app.set('trust proxy', 1);

// CORS: allow Vercel frontend and localhost by default, reflect configured origin if provided
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://dnd-fawn.vercel.app',
]);
if (config && typeof config.frontendOrigin === 'string' && config.frontendOrigin.trim()) {
  allowedOrigins.add(config.frontendOrigin.trim());
}
if (Array.isArray(config.allowedReturnOrigins)) {
  for (const o of config.allowedReturnOrigins) if (typeof o === 'string' && o.trim()) allowedOrigins.add(o.trim());
}
if (process.env.FRONTEND_ORIGIN) {
  allowedOrigins.add(process.env.FRONTEND_ORIGIN.trim());
}
if (process.env.ALLOWED_RETURN_ORIGINS) {
  for (const o of process.env.ALLOWED_RETURN_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean)) allowedOrigins.add(o);
}
const corsOptions = {
  origin: function(origin, callback) {
    // Allow non-browser (no origin), localhost, matching allowedOrigins, and any vercel.app subdomain
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app($|\/)/i.test(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  // X-User-Id is gone: it was the client-asserted identity Phase 1b replaced with a session
  // cookie. Leaving it allowed would advertise a header the server no longer reads.
  allowedHeaders: ['Content-Type','X-Campaign-Id','X-Diag-Token'],
  // Cookies only travel cross-origin with credentials enabled and an exact origin echoed back
  // (never '*'), which the origin function above guarantees.
  credentials: true,
  optionsSuccessStatus: 204,
};

// IMPORTANT: register CORS before other middleware so preflights always get headers
app.use(cors(corsOptions));
// Express 5 disallows '*' path strings; use a regex to match all paths for OPTIONS
app.options(/.*/, cors(corsOptions));

/** Read a positive integer from the environment, else fall back. Lets tests raise the caps. */
function envLimit(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Rate limiting to prevent overwhelming your home connection
const limiter = rateLimit({
  windowMs: envLimit('RATE_LIMIT_WINDOW_MS', 60 * 1000), // 1 minute
  limit: envLimit('RATE_LIMIT_MAX', 100), // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Credential endpoints get a much tighter budget than the general API: they are the ones worth
// grinding through with a password list, and a real user hits them once or twice a month.
const authLimiter = rateLimit({
  windowMs: envLimit('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  limit: envLimit('AUTH_RATE_LIMIT_MAX', 20),
  message: { error: 'too_many_auth_attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '10mb' })); // Increase payload limit
for (const path of ['/auth/login', '/auth/signup', '/auth/discord']) app.use(path, authLimiter);

// Mount order mirrors the original declaration order. Only /diag/oauth and / are reachable
// through the SPA fallback's regex, so they must stay ahead of mountStaticClient; the /api and
// /auth routers are excluded by that regex and can sit on either side of it.
app.use(authRoutes);
app.use(systemRoutes);
// /health and /diag/db used to be registered inside the listen callback, which put them behind
// the SPA fallback below — they would have 404ed into index.html the moment a client build
// existed. Phase 1a preserved that; Phase 1b moves them ahead of the fallback where they belong.
app.use(runtimeRoutes);
app.use(feedbackRoutes);
app.use(syncRoutes);
mountStaticClient(app);
app.use(playersRoutes);
app.use(campaignsRoutes);
app.use(invitesRoutes);
app.use(groupsRoutes);
app.use(usersRoutes);
app.use(availabilityRoutes);
// New in Phase 2, so it has no original position to preserve; it sits last because everything
// above it is the scheduler's declaration order and nothing here overlaps those paths.
app.use(charactersRoutes);

const port = config.port || 3001;

// Schema first, then listen. Ensuring it inside the listen callback meant the first requests
// could race the `sessions` table into existence; a failure is still only a warning, because a
// server that answers 500s is more debuggable than one that never binds a port.
async function start() {
  try {
    await ensureSchema(db);
    console.log('✅ DB schema ensured');
  } catch (e) {
    console.warn('⚠️  Failed to ensure DB schema:', e?.message);
  }
  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${port}`);
    console.log(`📊 Database: ${process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || process.env.DATABASE_URL || 'libsql'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();
