import chalk from 'chalk';
import { PORT } from './config';
import { startServer } from './server';
import { loadDomainLists } from './domain-service';
import { logError, ensureDataDirExists } from './utils';
import { isDev } from './config';

// Display welcome banner
console.log(`
${chalk.green('╔══════════════════════════════════════════════════════════════╗')}
${chalk.green('║')}                                                              ${chalk.green('║')}
${chalk.green('║')}  ${chalk.bold.white('DisposableMail Finder')}                                 ${chalk.green('║')}
${chalk.green('║')}  ${chalk.white('Identify disposable, privacy-focused, and free emails')}     ${chalk.green('║')}
${chalk.green('║')}                                     ${chalk.green('║')}
${chalk.green('╚══════════════════════════════════════════════════════════════╝')}
`);

// Initialize and start the server
async function initialize() {
  try {
    // Ensure data directory exists
    await ensureDataDirExists();

    // Load domain lists from files
    await loadDomainLists();

    // Start the server
    const actualPort = await startServer(PORT, isDev ? 1 : 0);
    console.log(`\n${chalk.green('✓')} ${chalk.bold('DisposableMail-finder running at')} ${chalk.cyan(`http://localhost:${actualPort}`)}\n`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logError(`Failed to initialize application: ${errorMessage}`);
    console.error(chalk.red(`\n❌ Failed to initialize application: ${errorMessage}\n`));
    process.exit(1);
  }
}

initialize();

export { createApp } from './server';