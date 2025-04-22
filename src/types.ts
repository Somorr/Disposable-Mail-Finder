export interface MxRecord {
    hostname: string;
    priority: number;
    ip: string;
}

export interface MxResult {
    hasMx: boolean;
    records: MxRecord[];
    error?: string;
}

export interface DmarcResult {
    hasDmarc: boolean;
    record: string;
    isTempMailDmarc: boolean;
    error?: string;
}

export interface VerifyMailResponse {
    block: boolean;
    disposable: boolean;
    domain: string;
    email_provider?: string;
    mx: boolean;
    mx_fallback: boolean;
    mx_host: string[];
    mx_ip: string[];
    mx_priority: Record<string, number>;
    mx_priority_ip: Record<string, Record<string, number>>;
    privacy: boolean;
    related_domains?: string[];
}

export interface EmailCheckResult {
    email: string;
    isDisposable: boolean;
    isPrivacy: boolean;
    isFreeProvider: boolean;
    isUniversity: boolean;
    isMailboxOrg: boolean;
    source: string;
    domain: string;
    mx: MxResult;
    dmarc: DmarcResult;
    apiChecked?: boolean;
    hasWeakSecurity?: boolean;
    emailProvider?: string;
    universityName?: string;
}

export interface DomainLists {
    disposable: Map<string, string>;
    privacy: Map<string, string>;
    free: Set<string>;
    newlyAdded: Set<string>;
    university: Map<string, string>;
}

export interface FileStatus {
    disposable: boolean;
    privacy: boolean;
    free: boolean;
    newlyAdded: boolean;
    university: boolean;
    verifyMailApiKeys?: boolean;
}