import dns from 'dns';
import util from 'util';
import { Resolver } from 'dns';
import validator from 'validator';
import xss from 'xss';
import { MxResult, DmarcResult } from './types';
import { DNS_SERVERS, DNS_TIMEOUT, DNS_RETRY_COUNT, DNS_RETRY_DELAY, TEMP_MAIL_DMARC } from './config';
import { logError } from './utils';

// Create a custom resolver that uses multiple DNS servers
const resolver = new Resolver();
resolver.setServers(DNS_SERVERS);

// Promisify DNS functions with our custom resolver
const resolveMx = util.promisify(resolver.resolveMx).bind(resolver);
const resolveTxt = util.promisify(resolver.resolveTxt).bind(resolver);
const lookup = util.promisify(dns.lookup); // Keep using system resolver for IP lookups

// Helper function to retry a function with exponential backoff
async function retry<T>(fn: () => Promise<T>, retries = DNS_RETRY_COUNT, delay = DNS_RETRY_DELAY): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * 1.5);
    }
}

// Check MX records for a domain with retry logic
export async function checkMxRecords(domain: string): Promise<MxResult> {
    try {
        // Sanitize and validate domain
        if (!validator.isFQDN(domain)) {
            await logError(`Invalid domain format rejected for MX check: ${domain}`);
            return { hasMx: false, records: [], error: 'Invalid domain format' };
        }

        const sanitizedDomain = validator.trim(domain.toLowerCase());

        // Add timeout and retry logic
        const mxRecords = await retry(async () => {
            // Create a promise that will be rejected after timeout
            const timeoutPromise = new Promise<dns.MxRecord[]>((_, reject) => {
                setTimeout(() => reject(new Error('DNS timeout')), DNS_TIMEOUT);
            });

            // Race between the actual DNS query and the timeout
            return Promise.race([
                resolveMx(sanitizedDomain),
                timeoutPromise
            ]);
        });

        if (!mxRecords || mxRecords.length === 0) {
            return { hasMx: false, records: [] };
        }

        // Sort MX records by priority (lower is higher priority)
        mxRecords.sort((a, b) => a.priority - b.priority);

        // Get IP addresses for MX records
        const mxDetails = await Promise.all(
            mxRecords.slice(0, 3).map(async (record) => {
                try {
                    const ipResult = await retry(() => lookup(record.exchange));
                    return {
                        hostname: xss(record.exchange),
                        priority: record.priority,
                        ip: xss(ipResult.address)
                    };
                } catch (err) {
                    return {
                        hostname: xss(record.exchange),
                        priority: record.priority,
                        ip: 'Could not resolve IP'
                    };
                }
            })
        );

        return { hasMx: true, records: mxDetails };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Improved error message
        const friendlyError = `Unable to verify mail server configuration for ${domain}. ${errorMessage}`;
        await logError(friendlyError);
        return { hasMx: false, records: [], error: friendlyError };
    }
}

// Check DMARC record for a domain with retry logic
export async function checkDmarcRecord(domain: string): Promise<DmarcResult> {
    try {
        // Sanitize and validate domain
        if (!validator.isFQDN(domain)) {
            await logError(`Invalid domain format rejected for DMARC check: ${domain}`);
            return { hasDmarc: false, record: '', isTempMailDmarc: false, error: 'Invalid domain format' };
        }

        const sanitizedDomain = validator.trim(domain.toLowerCase());
        const dmarcDomain = `_dmarc.${sanitizedDomain}`;

        // Add timeout and retry logic
        const records = await retry(async () => {
            // Create a promise that will be rejected after timeout
            const timeoutPromise = new Promise<string[][]>((_, reject) => {
                setTimeout(() => reject(new Error('DNS timeout')), DNS_TIMEOUT);
            });

            // Race between the actual DNS query and the timeout
            return Promise.race([
                resolveTxt(dmarcDomain),
                timeoutPromise
            ]);
        }).catch(() => null); // Handle the case where no records exist

        if (!records || records.length === 0) {
            return { hasDmarc: false, record: '', isTempMailDmarc: false };
        }

        // DMARC records are returned as arrays of strings, join them
        const dmarcRecord = records[0].join('');
        const isTempMailDmarc = dmarcRecord === TEMP_MAIL_DMARC;

        return {
            hasDmarc: true,
            record: xss(dmarcRecord),
            isTempMailDmarc
        };
    } catch (error) {
        // ENOTFOUND or ENODATA means no DMARC record exists
        if (error instanceof Error &&
            ((error as any).code === 'ENOTFOUND' ||
                (error as any).code === 'ENODATA')) {
            return { hasDmarc: false, record: '', isTempMailDmarc: false };
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        await logError(`Error checking DMARC for ${domain}: ${errorMessage}`);
        return { hasDmarc: false, record: '', isTempMailDmarc: false, error: errorMessage };
    }
}