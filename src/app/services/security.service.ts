import { Injectable, inject, computed } from '@angular/core';
import { HarParserService } from './har-parser.service';
import { HarEntry, HarHeader } from '../models/har.model';

export type Severity = 'high' | 'medium' | 'low' | 'info';

export interface SecurityFinding {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  recommendation: string;
  affectedEntries: AffectedEntry[];
}

export interface AffectedEntry {
  index: number;
  url: string;
  shortUrl: string;
  domain: string;
  detail?: string;
}

const SECURITY_HEADERS = [
  {
    name: 'content-security-policy',
    id: 'missing-csp',
    severity: 'high' as Severity,
    title: 'Missing Content-Security-Policy',
    description: 'CSP prevents XSS attacks by controlling which resources the browser is allowed to load.',
    recommendation: 'Add a Content-Security-Policy response header to all HTML responses.',
  },
  {
    name: 'strict-transport-security',
    id: 'missing-hsts',
    severity: 'high' as Severity,
    title: 'Missing Strict-Transport-Security (HSTS)',
    description: 'HSTS forces browsers to use HTTPS, preventing downgrade attacks and cookie hijacking.',
    recommendation: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains to all responses.',
  },
  {
    name: 'x-frame-options',
    id: 'missing-xfo',
    severity: 'medium' as Severity,
    title: 'Missing X-Frame-Options',
    description: 'Without X-Frame-Options, the page can be embedded in iframes enabling clickjacking attacks.',
    recommendation: 'Add X-Frame-Options: DENY or SAMEORIGIN to HTML responses.',
  },
  {
    name: 'x-content-type-options',
    id: 'missing-xcto',
    severity: 'medium' as Severity,
    title: 'Missing X-Content-Type-Options',
    description: 'Without this header, browsers may MIME-sniff responses, enabling content injection attacks.',
    recommendation: 'Add X-Content-Type-Options: nosniff to all responses.',
  },
  {
    name: 'permissions-policy',
    id: 'missing-pp',
    severity: 'low' as Severity,
    title: 'Missing Permissions-Policy',
    description: 'Permissions-Policy controls access to browser features like camera, mic, and geolocation.',
    recommendation: 'Add a Permissions-Policy header to restrict unnecessary browser feature access.',
  },
  {
    name: 'referrer-policy',
    id: 'missing-rp',
    severity: 'low' as Severity,
    title: 'Missing Referrer-Policy',
    description: 'Without Referrer-Policy, sensitive URL data may leak to third parties via the Referer header.',
    recommendation: 'Add Referrer-Policy: strict-origin-when-cross-origin to all responses.',
  },
];

@Injectable({ providedIn: 'root' })
export class SecurityService {
  private parser = inject(HarParserService);

  findings = computed<SecurityFinding[]>(() => {
    const entries = this.parser.entries();
    if (!entries.length) return [];

    const results: SecurityFinding[] = [];

    results.push(...this.checkMissingSecurityHeaders(entries));
    results.push(...this.checkInsecureCookies(entries));
    results.push(...this.checkMixedContent(entries));
    results.push(...this.checkSensitiveDataInUrls(entries));
    results.push(...this.checkDeprecatedHeaders(entries));

    return results.sort((a, b) => this.severityOrder(a.severity) - this.severityOrder(b.severity));
  });

  summary = computed(() => {
    const f = this.findings();
    return {
      high:   f.filter(x => x.severity === 'high').length,
      medium: f.filter(x => x.severity === 'medium').length,
      low:    f.filter(x => x.severity === 'low').length,
      info:   f.filter(x => x.severity === 'info').length,
      total:  f.length,
    };
  });

  private checkMissingSecurityHeaders(entries: HarEntry[]): SecurityFinding[] {
    const htmlEntries = entries.filter(e =>
      e.response.content.mimeType?.toLowerCase().includes('html') ||
      e.response.status === 200
    );
    if (!htmlEntries.length) return [];

    const findings: SecurityFinding[] = [];

    for (const headerDef of SECURITY_HEADERS) {
      const missing = htmlEntries.filter(e =>
        !this.hasHeader(e.response.headers, headerDef.name)
      );
      if (!missing.length) continue;

      findings.push({
        ...headerDef,
        category: 'Security Headers',
        affectedEntries: missing.slice(0, 10).map((e, i) => this.toAffected(e, entries.indexOf(e))),
      });
    }

    return findings;
  }

  private checkInsecureCookies(entries: HarEntry[]): SecurityFinding[] {
    const insecureSecure: AffectedEntry[] = [];
    const insecureHttpOnly: AffectedEntry[] = [];
    const insecureSameSite: AffectedEntry[] = [];

    entries.forEach((entry, i) => {
      const cookies = entry.response.cookies ?? [];
      const isHttps = entry.request.url.startsWith('https://');

      for (const cookie of cookies) {
        const affected = this.toAffected(entry, i, `Cookie: ${cookie.name}`);
        if (isHttps && !cookie.secure) insecureSecure.push(affected);
        if (!cookie.httpOnly) insecureHttpOnly.push(affected);
        if (!cookie.sameSite || cookie.sameSite.toLowerCase() === 'none') insecureSameSite.push(affected);
      }
    });

    const findings: SecurityFinding[] = [];

    if (insecureSecure.length) {
      findings.push({
        id: 'cookie-no-secure',
        severity: 'high',
        category: 'Cookies',
        title: 'Cookies Missing Secure Flag',
        description: 'Cookies without the Secure flag can be transmitted over HTTP, exposing them to interception.',
        recommendation: 'Set the Secure flag on all cookies served over HTTPS.',
        affectedEntries: insecureSecure.slice(0, 10),
      });
    }

    if (insecureHttpOnly.length) {
      findings.push({
        id: 'cookie-no-httponly',
        severity: 'medium',
        category: 'Cookies',
        title: 'Cookies Missing HttpOnly Flag',
        description: 'Cookies without HttpOnly can be accessed by JavaScript, increasing XSS risk.',
        recommendation: 'Set the HttpOnly flag on all session and authentication cookies.',
        affectedEntries: insecureHttpOnly.slice(0, 10),
      });
    }

    if (insecureSameSite.length) {
      findings.push({
        id: 'cookie-no-samesite',
        severity: 'low',
        category: 'Cookies',
        title: 'Cookies Missing SameSite Attribute',
        description: 'Cookies without SameSite may be sent in cross-site requests, enabling CSRF attacks.',
        recommendation: 'Set SameSite=Lax or SameSite=Strict on all cookies.',
        affectedEntries: insecureSameSite.slice(0, 10),
      });
    }

    return findings;
  }

  private checkMixedContent(entries: HarEntry[]): SecurityFinding[] {
    const mixed = entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) =>
        e.request.url.startsWith('http://') &&
        entries.some(other => other.request.url.startsWith('https://'))
      );

    if (!mixed.length) return [];

    return [{
      id: 'mixed-content',
      severity: 'high',
      category: 'Mixed Content',
      title: 'HTTP Resources Loaded on HTTPS Page',
      description: 'HTTP resources on an HTTPS page can be intercepted and tampered with by attackers.',
      recommendation: 'Serve all resources over HTTPS. Update all resource URLs to use https://.',
      affectedEntries: mixed.slice(0, 10).map(({ e, i }) => this.toAffected(e, i)),
    }];
  }

  private checkSensitiveDataInUrls(entries: HarEntry[]): SecurityFinding[] {
    const patterns = [
      { re: /[?&](token|access_token|api_key|apikey|secret|password|passwd|pwd|auth)=/i, label: 'Credentials in URL' },
      { re: /[?&](session|sid|sessionid)=/i, label: 'Session ID in URL' },
    ];

    const affected: AffectedEntry[] = [];

    entries.forEach((entry, i) => {
      for (const { re, label } of patterns) {
        if (re.test(entry.request.url)) {
          affected.push(this.toAffected(entry, i, label));
        }
      }
    });

    if (!affected.length) return [];

    return [{
      id: 'sensitive-in-url',
      severity: 'high',
      category: 'Information Exposure',
      title: 'Sensitive Data in URLs',
      description: 'Tokens, passwords, or session IDs in URLs are logged in server logs, browser history, and Referer headers.',
      recommendation: 'Move sensitive data to request headers or POST body. Never pass credentials in query strings.',
      affectedEntries: affected.slice(0, 10),
    }];
  }

  private checkDeprecatedHeaders(entries: HarEntry[]): SecurityFinding[] {
    const deprecated = [
      { name: 'x-xss-protection', label: 'X-XSS-Protection is deprecated' },
      { name: 'public-key-pins', label: 'HPKP (Public-Key-Pins) is deprecated and dangerous' },
    ];

    const affected: AffectedEntry[] = [];

    entries.forEach((entry, i) => {
      for (const d of deprecated) {
        if (this.hasHeader(entry.response.headers, d.name)) {
          affected.push(this.toAffected(entry, i, d.label));
        }
      }
    });

    if (!affected.length) return [];

    return [{
      id: 'deprecated-headers',
      severity: 'info',
      category: 'Security Headers',
      title: 'Deprecated Security Headers Detected',
      description: 'Some responses include headers that are deprecated and may cause issues in modern browsers.',
      recommendation: 'Remove X-XSS-Protection and Public-Key-Pins headers.',
      affectedEntries: affected.slice(0, 10),
    }];
  }

  private hasHeader(headers: HarHeader[], name: string): boolean {
    return headers.some(h => h.name.toLowerCase() === name.toLowerCase());
  }

  private toAffected(entry: HarEntry, index: number, detail?: string): AffectedEntry {
    let domain = '';
    let shortUrl = entry.request.url;
    try {
      const u = new URL(entry.request.url);
      domain = u.hostname;
      shortUrl = u.pathname;
    } catch { /* keep full */ }
    return { index: index + 1, url: entry.request.url, shortUrl, domain, detail };
  }

  private severityOrder(s: Severity): number {
    return { high: 0, medium: 1, low: 2, info: 3 }[s];
  }
}
