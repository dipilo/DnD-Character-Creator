const { parseCSV } = require('./csvParser');
const fetch = require('./httpFetch');

/* ---------- helpers to parse sheet id and fetch ---------- */
function parseSheetId(input) {
  if (!input) return null;
  input = input.trim();
  const m = input.match(/\/d\/([a-zA-Z0-9-_]+)(?:\/|$)/);
  if (m) return m[1];
  const m2 = input.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (m2) return m2[1];
  if (/^[a-zA-Z0-9-_]+$/.test(input)) return input;
  return null;
}

async function fetchSheetCSV(spreadsheetId, opts = {}) {
  const { gid, sheetName } = opts;
  const errors = [];
  try {
    let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    if (gid !== undefined && gid !== null) url += `&gid=${encodeURIComponent(gid)}`;
    const res = await fetch(url);
    const text = await res.text();
    if (res.ok) return parseCSV(text);
    errors.push({ method: 'export_csv', url, status: res.status, body: text.slice(0,200) });
  } catch (e) { errors.push({ method: 'export_csv', error: String(e) }); }

  try {
    let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
    if (sheetName) url += `&sheet=${encodeURIComponent(sheetName)}`;
    if (gid !== undefined && gid !== null) url += `&gid=${encodeURIComponent(gid)}`;
    const res = await fetch(url);
    const text = await res.text();
    if (res.ok) return parseCSV(text);
    errors.push({ method: 'gviz_csv', url, status: res.status, body: text.slice(0,200) });
  } catch (e) { errors.push({ method: 'gviz_csv', error: String(e) }); }

  try {
    let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;
    if (gid !== undefined && gid !== null) url += `&gid=${encodeURIComponent(gid)}`;
    const res = await fetch(url);
    const text = await res.text();
    if (res.ok) {
      const jsonText = text.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
      const obj = JSON.parse(jsonText);
      const cols = (obj.table && obj.table.cols || []).map(c => (c.label || c.id || '').toString());
      const rows = (obj.table && obj.table.rows || []).map(r => {
        const out = {};
        r.c.forEach((cell, i) => {
          out[cols[i] || `col${i}`] = (cell && ('v' in cell) ? cell.v : '');
        });
        return out;
      });
      return rows;
    }
    errors.push({ method: 'gviz_json', url, status: res.status, body: text.slice(0,200) });
  } catch (e) { errors.push({ method: 'gviz_json', error: String(e) }); }

  const err = new Error('All sheet fetch methods failed');
  err.attempts = errors;
  throw err;
}

// returns array of column labels for a spreadsheet (gviz JSON)
// robust fetchSheetHeaders - tries CSV export, gviz CSV, then gviz JSON
async function fetchSheetHeaders(spreadsheetId, opts = {}) {
  const { gid, sheetName } = opts || {};
  const attempts = [];

  // Helper to try an URL and return text if ok, otherwise record attempt
  async function tryUrl(url, tag) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (res.ok) return text;
      attempts.push({ tag, url, status: res.status, bodyPreview: text && text.slice(0,200) });
      return null;
    } catch (err) {
      attempts.push({ tag, url, error: String(err) });
      return null;
    }
  }

  // 1) Try export CSV (works for public or "anyone with link can view" sheets)
  let url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
  if (gid !== undefined && gid !== null) url += `&gid=${encodeURIComponent(gid)}`;
  let text = await tryUrl(url, 'export_csv');
  if (text) {
    try {
      // parseCSV returns array of objects if header row present
      const rows = parseCSV(text);
      if (Array.isArray(rows) && rows.length > 0) {
        const headers = Object.keys(rows[0]);
        return headers;
      }
      // if parseCSV returned empty or not objects, as fallback try splitting first line
      const firstLine = text.split(/\r?\n/)[0] || '';
      if (firstLine.trim()) return firstLine.split(',').map(s => s.trim());
    } catch (e) {
      // fall through to next attempts
      attempts.push({ tag: 'export_csv_parse_error', error: String(e) });
    }
  }

  // 2) Try gviz CSV
  url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
  if (sheetName) url += `&sheet=${encodeURIComponent(sheetName)}`;
  if (gid !== undefined && gid !== null) url += `&gid=${encodeURIComponent(gid)}`;
  text = await tryUrl(url, 'gviz_csv');
  if (text) {
    try {
      const rows = parseCSV(text);
      if (Array.isArray(rows) && rows.length > 0) {
        return Object.keys(rows[0]);
      }
      const firstLine = text.split(/\r?\n/)[0] || '';
      if (firstLine.trim()) return firstLine.split(',').map(s => s.trim());
    } catch (e) {
      attempts.push({ tag: 'gviz_csv_parse_error', error: String(e) });
    }
  }

  // 3) Try gviz JSON and extract column labels
  url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;
  if (gid !== undefined && gid !== null) url += `&gid=${encodeURIComponent(gid)}`;
  if (sheetName) url += `&sheet=${encodeURIComponent(sheetName)}`;
  text = await tryUrl(url, 'gviz_json');
  if (text) {
    try {
      const jsonText = text.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
      const obj = JSON.parse(jsonText);
      const cols = (obj.table && obj.table.cols || []).map(c => (c.label || c.id || '').toString());
      if (cols.length) return cols;
    } catch (e) {
      attempts.push({ tag: 'gviz_json_parse_error', error: String(e), preview: text && text.slice(0,200) });
    }
  }

  // if none worked, throw with collected attempts so client can show useful info
  const err = new Error('headers fetch failed');
  err.attempts = attempts;
  throw err;
}

module.exports = { parseSheetId, fetchSheetCSV, fetchSheetHeaders };
