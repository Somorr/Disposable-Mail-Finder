import express, { Request, Response } from 'express';
import path from 'path';
import xss from 'xss';
import validator from 'validator';
import { apiLimiter, validateEmailInput } from './middleware';
import { checkMxRecords, checkDmarcRecord } from './dns-service';
import { checkDomainWithVerifyMailApi, addNewDisposableDomain, addRelatedDisposableDomains } from './domain-service';
import { logError } from './utils';
import { domainLists, fileStatus, verifyMailApiKeys } from './config';
import { EmailCheckResult } from './types';

const router = express.Router();

// Routes
router.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API endpoint to check file status
router.get('/api/file-status', (req: Request, res: Response) => {

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const statusWithVerifyMailApiKeys = {
    ...fileStatus,
    verifyMailApiKeys: verifyMailApiKeys.length > 0
  };

  res.json(statusWithVerifyMailApiKeys);
});

// API endpoint to check an email - apply rate limiter and validation
router.post('/api/check-email', apiLimiter, validateEmailInput, async (req: Request, res: Response) => {
  try {
    const email = req.body.email;
    const emailParts = email.split('@');
    const fullDomain = emailParts[1].toLowerCase();

    // Extract domain (e.g. "gmail" from "gmail.com")
    const domainRegex = /^[^\s@]+@([^\s@]+)\.[^\s@]+$/;
    const match = email.match(domainRegex);
    const domain = match ? match[1].toLowerCase() : '';

    let result: EmailCheckResult = {
      email: xss(email), // Sanitize for output
      isDisposable: false,
      isPrivacy: false,
      isFreeProvider: false,
      isUniversity: false, // Added university check flag
      isMailboxOrg: fullDomain === 'mailbox.org',
      source: '',
      domain: xss(fullDomain), // Sanitize for output
      mx: { hasMx: false, records: [] },
      dmarc: { hasDmarc: false, record: '', isTempMailDmarc: false },
      hasWeakSecurity: false
    };

    // Check if the domain is in any of our lists
    if (domainLists.disposable.has(fullDomain)) {
      result.isDisposable = true;
      result.source = xss(domainLists.disposable.get(fullDomain) || '');
    } else if (domainLists.newlyAdded.has(fullDomain)) {
      result.isDisposable = true;
      result.source = 'Newly discovered disposable domain';
    } else if (domainLists.privacy.has(fullDomain)) {
      result.isPrivacy = true;
      result.source = xss(domainLists.privacy.get(fullDomain) || '');
    } else if (domainLists.university.has(fullDomain)) {
      // Check if the domain is a university domain
      result.isUniversity = true;
      result.universityName = xss(domainLists.university.get(fullDomain) || '');
      result.source = `University: ${result.universityName}`;
    } else if (domainLists.free.has(domain) || domainLists.free.has(fullDomain)) {
      result.isFreeProvider = true;
    }

    // Check MX records
    result.mx = await checkMxRecords(fullDomain);

    // Check DMARC if we have valid MX records
    if (result.mx.hasMx) {
      result.dmarc = await checkDmarcRecord(fullDomain);

      // If DMARC matches temp-mail.org and not already marked as disposable
      if (result.dmarc.isTempMailDmarc && !result.isDisposable) {
        result.isDisposable = true;
        result.source = 'temp-mail.org (detected by DMARC)';

        // Add to newly discovered disposable domains
        await addNewDisposableDomain(fullDomain);
      }
    }

    // If domain has MX records but isn't in our lists and has no DMARC, check with VerifyMail API
    if (result.mx.hasMx &&
        !result.isDisposable &&
        !result.isPrivacy &&
        !result.isFreeProvider &&
        !result.isMailboxOrg &&
        !result.dmarc.hasDmarc &&
        verifyMailApiKeys.length > 0) {

      const apiResult = await checkDomainWithVerifyMailApi(fullDomain);
      result.apiChecked = true;

      if (apiResult !== null) {
        if (apiResult.isDisposable) {
          result.isDisposable = true;
          result.source = apiResult.source;
          result.emailProvider = apiResult.emailProvider;

          // Add to newly discovered disposable domains
          await addNewDisposableDomain(fullDomain, apiResult.source);

          // Handle related domains if available
          if (apiResult.relatedDomains && apiResult.relatedDomains.length > 0) {
            await addRelatedDisposableDomains(apiResult.relatedDomains, apiResult.emailProvider);
          }
        } else if (apiResult.isPrivacy) {
          result.isPrivacy = true;
          result.source = apiResult.source;
        }
      } else {
        // API check failed or no API keys available
        // Mark as potentially weak security if has MX but no DMARC
        result.hasWeakSecurity = true;
      }
    } else if (result.mx.hasMx && !result.dmarc.hasDmarc &&
        !result.isDisposable && !result.isPrivacy) {
      // If domain has MX records but no DMARC and we couldn't check with API
      result.hasWeakSecurity = true;
    }

    // Add Cache-Control header to prevent caching of results
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logError(`Error in /api/check-email: ${errorMessage}`);

    // Don't expose detailed errors to the client
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

export default router;