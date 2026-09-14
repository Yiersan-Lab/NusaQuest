/**
 * NusaQuest — Vercel Serverless Function Handler
 * Wraps the Express backend app for serverless execution on Vercel.
 */

const { app } = require('../server.js');

module.exports = app;
