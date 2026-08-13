// The API calls Discord and Google Sheets through node-fetch rather than the global fetch.
// Moved verbatim out of server.js so every caller keeps the same client.
module.exports = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
