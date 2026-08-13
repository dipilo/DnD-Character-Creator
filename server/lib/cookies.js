// Reading cookies needs no dependency. Express ships only the write half (res.cookie /
// res.clearCookie); cookie-parser exists purely to populate req.cookies, which is ten lines.

/** Parse a Cookie request header into a null-prototype map. First occurrence of a name wins. */
function parseCookieHeader(header) {
  const out = Object.create(null);
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || out[name] !== undefined) continue;
    let value = part.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[name] = decodeURIComponent(value);
    } catch (_) {
      out[name] = value;
    }
  }
  return out;
}

/** Read one cookie off a request, parsing the header at most once per request. */
function readCookie(req, name) {
  if (!req.parsedCookies) req.parsedCookies = parseCookieHeader(req.headers && req.headers.cookie);
  const value = req.parsedCookies[name];
  return value === undefined ? null : value;
}

module.exports = { parseCookieHeader, readCookie };
