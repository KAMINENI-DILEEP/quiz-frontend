const compression = require('compression');
const express = require('express');
const app = express();

// 1. Compress all outgoing JSON payloads
app.use(compression());

// 2. Set Keep-Alive headers for low-latency TCP connections
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=60');
  next();
});