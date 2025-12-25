/**
 * Custom Next.js Server with Scheduler
 * Starts the DMARC processing scheduler alongside the Next.js app
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Import and start scheduler (only after Next.js is ready)
  const { startScheduler } = require('./src/lib/services/scheduler.ts');

  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);

      // Start the scheduler
      try {
        console.log('> Starting DMARC scheduler...');
        startScheduler();
        console.log('> Scheduler started successfully');
      } catch (error) {
        console.error('> Failed to start scheduler:', error);
      }
    });
});
