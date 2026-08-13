// csvParser.js — robust CSV parsing for Google Sheets CSV export
const { parse } = require('csv-parse/sync');

function parseCSV(text) {
  // returns array of objects
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true
  });
  return records;
}

module.exports = { parseCSV };