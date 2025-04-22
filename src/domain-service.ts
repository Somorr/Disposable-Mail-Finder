import fs from 'fs';
import { promises as fsPromises } from 'fs';
import validator from 'validator';
import xss from 'xss';
import axios from 'axios';
import path from 'path';
import { VerifyMailResponse } from './types';
import { domainLists, fileStatus, DATA_DIR, API_TIMEOUT, VERIFY_MAIL_API_BASE_URL, verifyMailApiKeys } from './config';
import { getSafePath, logError, generateRequestId } from './utils';

// Track API key usage with a simple round-robin approach
let currentApiKeyIndex = 0;

// Function to get the next API key in rotation
function getNextApiKey(): string | null {
  if (verifyMailApiKeys.length === 0) {
    return null;
  }
  const key = verifyMailApiKeys[currentApiKeyIndex];
  // Move to next key for next request
  currentApiKeyIndex = (currentApiKeyIndex + 1) % verifyMailApiKeys.length;
  return key;
}

// Function to add a newly discovered disposable domain securely
export async function addNewDisposableDomain(domain: string, source: string = 'VerifyMail API'): Promise<void> {
  try {
    // Sanitize domain input
    if (!validator.isFQDN(domain)) {
      await logError(`Invalid domain format rejected: ${domain}`);
      return;
    }

    const sanitizedDomain = validator.trim(domain.toLowerCase());

    // Check if domain already exists in the disposable list or newly added list
    if (domainLists.disposable.has(sanitizedDomain) || domainLists.newlyAdded.has(sanitizedDomain)) {
      return; // Domain already known, no need to add
    }

    // Add to newly added list
    const newlyAddedPath = getSafePath(DATA_DIR, 'newlyadded.txt');
    const entry = `${sanitizedDomain}\n`;
    domainLists.newlyAdded.add(sanitizedDomain);
    await fsPromises.appendFile(newlyAddedPath, entry);

    console.log(`Added ${sanitizedDomain} to newly discovered disposable domains (Source: ${source})`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logError(`Failed to add domain ${domain} to newlyadded.txt: ${errorMessage}`);
  }
}

// Add multiple related domains from API response
export async function addRelatedDisposableDomains(
    domains: string[],
    emailProvider: string | undefined
): Promise<void> {
  try {
    if (!domains || domains.length === 0) return;

    // Check if we have the email provider in our disposable.txt
    const disposablePath = getSafePath(DATA_DIR, 'disposable.txt');
    let disposableContent = await fsPromises.readFile(disposablePath, 'utf8');
    const providerMarker = emailProvider ? `## ${emailProvider}` : null;

    if (providerMarker && !disposableContent.includes(providerMarker)) {
      // Add a new section for this email provider
      const newSection = `\n${providerMarker}\n${domains.join('\n')}\n`;
      await fsPromises.appendFile(disposablePath, newSection);
      console.log(`Added new section for ${emailProvider} with ${domains.length} domains`);

      // Update domains in memory
      domains.forEach(domain => {
        if (validator.isFQDN(domain)) {
          const sanitizedDomain = validator.trim(domain.toLowerCase());
          domainLists.disposable.set(sanitizedDomain, emailProvider || 'VerifyMail API');
        }
      });
    } else if (providerMarker) {
      // Provider exists, need to update the section
      // For simplicity, we'll just add the domains to newlyadded.txt instead
      for (const domain of domains) {
        if (validator.isFQDN(domain)) {
          await addNewDisposableDomain(domain, emailProvider);
        }
      }
    } else {
      // No provider specified, just add to newlyadded.txt
      for (const domain of domains) {
        if (validator.isFQDN(domain)) {
          await addNewDisposableDomain(domain, 'VerifyMail API - Related Domain');
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logError(`Failed to add related domains: ${errorMessage}`);
  }
}

// Check domain with VerifyMail API
export async function checkDomainWithVerifyMailApi(domain: string): Promise<{
  isDisposable: boolean;
  source: string;
  emailProvider?: string;
  relatedDomains?: string[];
  isPrivacy?: boolean;
} | null> {
  try {
    // Validate domain before sending to API
    if (!validator.isFQDN(domain)) {
      await logError(`Invalid domain rejected for API check: ${domain}`);
      return null;
    }

    const sanitizedDomain = validator.trim(domain.toLowerCase());

    // Get next API key
    const apiKey = getNextApiKey();
    if (!apiKey) {
      console.log('No VerifyMail API keys available');
      return null;
    }

    // Generate a request ID for tracking
    const requestId = generateRequestId();
    console.log(`[${requestId}] Checking domain with VerifyMail API: ${sanitizedDomain}`);

    // Construct API URL
    const apiUrl = `${VERIFY_MAIL_API_BASE_URL}/${encodeURIComponent(sanitizedDomain)}?key=${apiKey}`;

    const response = await axios.get<VerifyMailResponse>(apiUrl, {
      timeout: API_TIMEOUT,
      headers: {
        'User-Agent': 'DisposableMail-finder/1.0',
        'Accept': 'application/json'
      }
    });

    console.log(`[${requestId}] VerifyMail API response received for ${sanitizedDomain}`);

    if (response.data) {
      return {
        isDisposable: response.data.disposable === true,
        isPrivacy: response.data.privacy === true,
        source: response.data.email_provider || 'VerifyMail API',
        emailProvider: response.data.email_provider,
        relatedDomains: response.data.related_domains
      };
    }

    return {
      isDisposable: false,
      source: ''
    };
  } catch (error) {
    let errorMessage = 'Unknown error';

    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code outside of 2xx
        if (error.response.status === 429) {
          errorMessage = `API rate limit exceeded (429) - You have hit your assigned rate limit for the VerifyMail API. Please try again later.`;
        } else {
          errorMessage = `API response error: ${error.response.status}`;
        }
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'API request timeout or no response';
      } else {
        // Something happened in setting up the request
        errorMessage = `API request setup error: ${error.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    await logError(`VerifyMail API error for domain ${domain}: ${errorMessage}`);
    return null; // Return null for API failures
  }
}

// Load domain lists and API keys from files securely
export async function loadDomainLists(): Promise<void> {
  try {
    // Create error.log if it doesn't exist
    const errorLogPath = getSafePath(DATA_DIR, 'error.log');
    if (!fs.existsSync(errorLogPath)) {
      await fsPromises.writeFile(errorLogPath, '# Error log for DisposableMail-finder\n', { mode: 0o640 });
      console.log(`Created error log: ${errorLogPath}`);
    }

    // Check for university domains
    const universityPath = getSafePath(DATA_DIR, 'universities.txt');
    if (fs.existsSync(universityPath)) {
      fileStatus.university = true;
      const universityContent = await fsPromises.readFile(universityPath, 'utf8');
      let currentUniversity = '';
      universityContent.split('\n').forEach(line => {
        line = validator.trim(line);
        if (line && line.startsWith('#')) {
          currentUniversity = xss(line.substring(1).trim());
        } else if (line && !line.startsWith('#') && currentUniversity) {
          domainLists.university.set(line.toLowerCase(), currentUniversity);
        }
      });
      console.log(`Loaded ${domainLists.university.size} university domains`);
    } else {
      console.warn(`'universities.txt' file not found at ${universityPath}`);
      // Create an empty file with example
      await fsPromises.writeFile(
          universityPath,
          '# University email domains\n# Universidad de Mendoza\num.edu.ar\n',
          { mode: 0o640 }
      );
    }
    // Check if files exist and load them
    const disposablePath = getSafePath(DATA_DIR, 'disposable.txt');
    if (fs.existsSync(disposablePath)) {
      fileStatus.disposable = true;
      const disposableContent = await fsPromises.readFile(disposablePath, 'utf8');
      let currentSource = '';
      disposableContent.split('\n').forEach(line => {
        line = validator.trim(line);
        if (line && line.startsWith('##')) {
          currentSource = xss(line.substring(2).trim());
        } else if (line && !line.startsWith('#') && currentSource) {
          domainLists.disposable.set(line.toLowerCase(), currentSource);
        }
      });
      console.log(`Loaded ${domainLists.disposable.size} disposable domains`);
    } else {
      console.warn(`'disposable.txt' file not found at ${disposablePath}`);
      // Create an empty file
      await fsPromises.writeFile(
          disposablePath,
          '# Disposable email domains\n## example.com\nexample.disposable.com\n',
          { mode: 0o640 }
      );
    }

    const privacyPath = getSafePath(DATA_DIR, 'privacy.txt');
    if (fs.existsSync(privacyPath)) {
      fileStatus.privacy = true;
      const privacyContent = await fsPromises.readFile(privacyPath, 'utf8');
      let currentSource = '';
      privacyContent.split('\n').forEach(line => {
        line = validator.trim(line);
        if (line && line.startsWith('##')) {
          currentSource = xss(line.substring(2).trim());
        } else if (line && !line.startsWith('#') && currentSource) {
          domainLists.privacy.set(line.toLowerCase(), currentSource);
        }
      });
      console.log(`Loaded ${domainLists.privacy.size} privacy domains`);
    } else {
      console.warn(`'privacy.txt' file not found at ${privacyPath}`);
      // Create an empty file
      await fsPromises.writeFile(
          privacyPath,
          '# Privacy-focused email domains\n## example.com\nexample.privacy.com\n',
          { mode: 0o640 }
      );
    }

    const freePath = getSafePath(DATA_DIR, 'free_provider.txt');
    if (fs.existsSync(freePath)) {
      fileStatus.free = true;
      const freeContent = await fsPromises.readFile(freePath, 'utf8');
      freeContent.split('\n').forEach(line => {
        line = validator.trim(line);
        if (line && !line.startsWith('#')) {
          domainLists.free.add(line.toLowerCase());
        }
      });
      console.log(`Loaded ${domainLists.free.size} free email providers`);
    } else {
      console.warn(`'free_provider.txt' file not found at ${freePath}`);
      // Create an empty file with common free providers
      await fsPromises.writeFile(
          freePath,
          '# Common free email providers\ngmail\nhotmail\noutlook\nyahoo\nprotonmail\naol\nicloud\nmail\ngmx\nyandex\nzoho\ntutanota\ninbox\nfastmail\nhushmail\nrackspace\nlycos\naim\ntuta\ncock\nmailbox\nshortmail\npm\nmail.com\n',
          { mode: 0o640 }
      );
    }

    // Check for newly added disposable domains
    const newlyAddedPath = getSafePath(DATA_DIR, 'newlyadded.txt');
    if (fs.existsSync(newlyAddedPath)) {
      fileStatus.newlyAdded = true;
      const newlyAddedContent = await fsPromises.readFile(newlyAddedPath, 'utf8');
      newlyAddedContent.split('\n').forEach(line => {
        line = validator.trim(line);
        if (line && !line.startsWith('#')) {
          domainLists.newlyAdded.add(line.toLowerCase());
        }
      });
      console.log(`Loaded ${domainLists.newlyAdded.size} newly discovered disposable domains`);
    } else {
      console.warn(`'newlyadded.txt' file not found at ${newlyAddedPath}`);
      // Create an empty file
      await fsPromises.writeFile(
          newlyAddedPath,
          '# Newly discovered disposable email domains\n',
          { mode: 0o640 }
      );
    }

    // Load VerifyMail API keys
    const verifyMailApiKeysPath = getSafePath(DATA_DIR, 'verifymail_api.txt');
    if (fs.existsSync(verifyMailApiKeysPath)) {
      fileStatus.verifyMailApiKeys = true;
      const apiKeysContent = await fsPromises.readFile(verifyMailApiKeysPath, 'utf8');
      apiKeysContent.split('\n').forEach(line => {
        line = validator.trim(line);
        if (line && !line.startsWith('#')) {
          verifyMailApiKeys.push(line);
        }
      });
      console.log(`Loaded ${verifyMailApiKeys.length} VerifyMail API keys`);
    } else {
      console.warn(`'verifymail_api.txt' file not found at ${verifyMailApiKeysPath}`);
      // Create an empty file with a placeholder for the API key
      await fsPromises.writeFile(
          verifyMailApiKeysPath,
          '# VerifyMail.io API keys (one per line)\n# Add your API keys below\nYOUR_API_KEY_HERE\n',
          { mode: 0o640 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logError(`Error loading domain lists: ${errorMessage}`);
    throw error;
  }
}