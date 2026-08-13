const express = require('express');

const router = express.Router();

// Simple index route so platform probes and manual visits don't 404
router.get('/', (req, res) => {
  res.type('text/plain').send('DnD backend is running. See /health for status.');
});

module.exports = router;
