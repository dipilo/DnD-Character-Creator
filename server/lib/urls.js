const { config } = require('../config');

// Determine if a returnTo URL is allowed to prevent open redirects
function isAllowedReturnTo(rt, serverOrigin) {
  if (!rt || typeof rt !== 'string') return false;
  try {
    // Always allow returning to the same origin as the server
    if (rt.startsWith(serverOrigin)) return true;
    // Allow localhost for development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(rt)) return true;
    // Optionally allow a configured frontend origin or list of origins
    const allowList = [];
    if (config && typeof config.frontendOrigin === 'string') allowList.push(config.frontendOrigin);
    if (config && Array.isArray(config.allowedReturnOrigins)) allowList.push(...config.allowedReturnOrigins);
    if (process.env.FRONTEND_ORIGIN) allowList.push(process.env.FRONTEND_ORIGIN);
    if (process.env.ALLOWED_RETURN_ORIGINS) {
      allowList.push(...process.env.ALLOWED_RETURN_ORIGINS.split(',').map(s => s.trim()).filter(Boolean));
    }
    // As a pragmatic default for this app, allow vercel.app subdomains
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app(\/|$)/i.test(rt)) return true;
    return allowList.some(prefix => typeof prefix === 'string' && prefix.length > 0 && rt.startsWith(prefix));
  } catch (_) { return false; }
}

// Helpers to build absolute URLs correctly behind proxies (ensure https on Render)
function getRequestProto(req) {
  const xf = req.headers['x-forwarded-proto'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.protocol || 'http';
}
function getServerOrigin(req) {
  const host = req.get('host');
  let proto = getRequestProto(req) || 'http';
  // Force https for common managed hosts if proto is ambiguous
  if (proto !== 'https') {
    if (/onrender\.com$/i.test(host)) proto = 'https';
  }
  return `${proto}://${host}`;
}

module.exports = { isAllowedReturnTo, getRequestProto, getServerOrigin };
