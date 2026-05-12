import { Injectable, inject, computed, signal } from '@angular/core';
import { HarParserService } from './har-parser.service';
import { HarEntry } from '../models/har.model';

export interface SlowRequest {
  index: number;
  method: string;
  url: string;
  shortUrl: string;
  domain: string;
  status: number;
  timeMs: number;
  entry: HarEntry;
}

export interface DuplicateGroup {
  key: string;           // method + url
  method: string;
  url: string;
  shortUrl: string;
  domain: string;
  count: number;
  totalMs: number;
  requests: Array<{ index: number; timeMs: number; status: number }>;
}

@Injectable({ providedIn: 'root' })
export class PerformanceService {
  private parser = inject(HarParserService);

  slowThresholdMs = signal(1000);

  slowRequests = computed<SlowRequest[]>(() => {
    const threshold = this.slowThresholdMs();
    return this.parser.entries()
      .map((entry, i) => this.toSlowRequest(entry, i))
      .filter(r => r.timeMs >= threshold)
      .sort((a, b) => b.timeMs - a.timeMs);
  });

  duplicateGroups = computed<DuplicateGroup[]>(() => {
    const map = new Map<string, { entry: HarEntry; index: number }[]>();

    this.parser.entries().forEach((entry, i) => {
      const key = `${entry.request.method}::${entry.request.url.split('?')[0]}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ entry, index: i + 1 });
    });

    const groups: DuplicateGroup[] = [];
    for (const [key, items] of map) {
      if (items.length < 2) continue;
      const first = items[0].entry;
      let domain = '';
      let shortUrl = first.request.url;
      try {
        const u = new URL(first.request.url);
        domain = u.hostname;
        shortUrl = u.pathname;
      } catch { /* keep full */ }

      groups.push({
        key,
        method: first.request.method,
        url: first.request.url.split('?')[0],
        shortUrl,
        domain,
        count: items.length,
        totalMs: items.reduce((s, i) => s + i.entry.time, 0),
        requests: items.map(i => ({
          index: i.index,
          timeMs: i.entry.time,
          status: i.entry.response.status,
        })),
      });
    }

    return groups.sort((a, b) => b.count - a.count);
  });

  private toSlowRequest(entry: HarEntry, i: number): SlowRequest {
    let domain = '';
    let shortUrl = entry.request.url;
    try {
      const u = new URL(entry.request.url);
      domain = u.hostname;
      shortUrl = u.pathname + (u.search || '');
    } catch { /* keep full */ }

    return {
      index: i + 1,
      method: entry.request.method,
      url: entry.request.url,
      shortUrl,
      domain,
      status: entry.response.status,
      timeMs: entry.time,
      entry,
    };
  }
}
