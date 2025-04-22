import http from 'http';
import express from 'express';
import path from 'path';
import chalk from 'chalk';
import { securityMiddleware, limiter, errorHandler } from './middleware';
import routes from './routes';
import { isDev } from './config';
import { logError } from './utils';

export function createApp() {
  const app = express();

  // Apply security middleware
  app.use(securityMiddleware);

  // Apply rate limiting to all requests
  app.use(limiter);

  // Middleware for parsing request bodies
  app.use(express.json({ limit: '10kb' })); // Limit JSON body size
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Serve static files
  app.use(express.static(path.join(__dirname, '../public'), {
    setHeaders: (res, filePath) => {
      // Apply appropriate caching rules
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        // Cache static assets for 1 day
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  }));

  // Apply routes
  app.use(routes);

  // Register error handling middleware
  app.use(errorHandler);

  return app;
}

// Function to start the server on the first available port with enhanced security
export const startServer = (port: number, maxRetries: number = 1): Promise<number> => {
  const app = createApp();

  return new Promise((resolve, reject) => {
    const server = http.createServer(app);

    // Set server timeouts
    server.timeout = 30000; // 30 seconds
    server.keepAliveTimeout = 5000; // 5 seconds

    server.listen(port);

    server.on('listening', () => {
      console.log(`
${chalk.green('╔══════════════════════════════════════════════════════╗')}
${chalk.green('║')}  ${chalk.bold.white('DisposableMail Finder Server')}\t\t               ${chalk.green('║')}
${chalk.green('║')}  ${chalk.cyan(`Server started successfully on port ${port}`)}            ${chalk.green('║')}
${chalk.green('║')}  ${chalk.yellow(`Mode: ${isDev ? 'Development' : 'Production'}`)} \t\t\t\t       ${chalk.green('║')}
${chalk.green('╚══════════════════════════════════════════════════════╝')}
      `);
      resolve(port);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        if (isDev && maxRetries > 0) {
          console.log(chalk.yellow(`Port ${port} is in use, trying ${port + 1}...`));
          server.close();
          startServer(port + 1, maxRetries - 1)
              .then(resolve)
              .catch(reject);
        } else if (!isDev) {
          reject(new Error(chalk.red(`Port ${port} is already in use. Please free up this port for production use.`)));
        } else {
          reject(new Error(chalk.red(`Port ${port} is already in use and max retries reached.`)));
        }
      } else {
        reject(error);
      }
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log(chalk.yellow('SIGTERM received, shutting down gracefully'));
      server.close(() => {
        console.log(chalk.green('Server closed'));
        process.exit(0);
      });

      // Force close if not closed within 10 seconds
      setTimeout(() => {
        console.error(chalk.red('Could not close connections in time, forcefully shutting down'));
        process.exit(1);
      }, 10000);
    });
  });
};