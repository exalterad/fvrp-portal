/**
 * Vercel serverless entry – används bara när du deployar till Vercel.
 * Alla anrop dirigeras hit via vercel.json.
 */
const app = require('../server.js');
module.exports = app;
