import path from 'path';
import { DomainLists, FileStatus } from './types';

export const isDev = process.env.NODE_ENV !== 'production';

export const PORT = isDev ? 9090 : 6060;

// Public Google DNS and Cloudflare DNS servers for better reliability
export const DNS_SERVERS = ['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1'];

export const DNS_TIMEOUT = 5000; // 5 seconds
export const DNS_RETRY_COUNT = 3;
export const DNS_RETRY_DELAY = 1000; // 1 second

// Specific DMARC record for temp-mail.org
export const TEMP_MAIL_DMARC = "v=DMARC1; p=reject; rua=mailto:reporterdmarc@yandex.ru; ruf=mailto:reporterdmarc@yandex.ru; rf=afrf; sp=reject; fo=1; pct=100; ri=604800; adkim=s; aspf=s";

// API timeout
export const API_TIMEOUT = 5000; // 5 seconds

// VerifyMail API base URL
export const VERIFY_MAIL_API_BASE_URL = "https://verifymail.io/api";

// Path to data directory
export const DATA_DIR = path.join(process.cwd(), 'data');

// Domain lists
export const domainLists: DomainLists = {
  disposable: new Map<string, string>(),
  privacy: new Map<string, string>(),
  free: new Set<string>(),
  newlyAdded: new Set<string>(),
  university: new Map<string, string>()
};

// API keys
export const verifyMailApiKeys: string[] = [];

// Status of data files
export const fileStatus: FileStatus = {
  disposable: false,
  privacy: false,
  free: false,
  newlyAdded: false,
  university: false,
  verifyMailApiKeys: false
};

// Content Security Policy directives
export const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
  styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
  objectSrc: ["'none'"],
  mediaSrc: ["'none'"],
  frameSrc: ["'none'"],
};