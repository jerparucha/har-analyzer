import { Component, inject, computed, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { HarParserService } from '../../services/har-parser.service';
import { normalizeUrlPath } from '../../utils/url.utils';

interface FailedCluster {
  method: string;
  path: string;
  count: number;
  statusBreakdown: string;
  filterQuery: string;
}

interface RetryLoop {
  method: string;
  path: string;
  count: number;
  spanMs: number;
  avgIntervalMs: number;
  filterQuery: string;
}

interface EndpointStat {
  method: string;
  path: string;
  count: number;
  avgTime: number;
  p95Time: number;
  errorRate: number;
  filterQuery: string;
}

type SortField = 'path' | 'count' | 'avgTime' | 'p95Time' | 'errorRate';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, MatButtonModule],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.scss',
})
export class AnalysisComponent {
  private parser = inject(HarParserService);

  @Output() filterRequested = new EventEmitter<string>();

  sortField = signal<SortField>('avgTime');
  sortDir   = signal<'asc' | 'desc'>('desc');

  failedClusters = computed<FailedCluster[]>(() => {
    const entries = this.parser.entries();
    const failed = entries.filter(e => e.response.status >= 400);
    if (!failed.length) return [];

    const map = new Map<string, { method: string; path: string; statuses: Map<number, number>; count: number }>();
    for (const e of failed) {
      const path = normalizeUrlPath(e.request.url);
      const key = `${e.request.method} ${path}`;
      const cur = map.get(key) ?? { method: e.request.method, path, statuses: new Map(), count: 0 };
      cur.count++;
      cur.statuses.set(e.response.status, (cur.statuses.get(e.response.status) ?? 0) + 1);
      map.set(key, cur);
    }

    return [...map.values()]
      .sort((a, b) => b.count - a.count)
      .map(c => ({
        method: c.method,
        path: c.path,
        count: c.count,
        statusBreakdown: [...c.statuses.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([s, n]) => `${s} ×${n}`)
          .join(', '),
        filterQuery: this.pathPrefix(c.path),
      }));
  });

  retryLoops = computed<RetryLoop[]>(() => {
    const entries = this.parser.entries();
    if (!entries.length) return [];

    const t0 = new Date(entries[0].startedDateTime).getTime();
    const groups = new Map<string, Array<number>>();

    for (const e of entries) {
      const path = normalizeUrlPath(e.request.url);
      const mime = e.response.content.mimeType?.toLowerCase() ?? '';
      if (mime.includes('css') || mime.includes('javascript') || mime.includes('image') || mime.includes('font')) continue;
      const key = `${e.request.method} ${path}`;
      const startMs = new Date(e.startedDateTime).getTime() - t0;
      const arr = groups.get(key) ?? [];
      arr.push(startMs);
      groups.set(key, arr);
    }

    const loops: RetryLoop[] = [];
    for (const [key, times] of groups) {
      if (times.length < 3) continue;
      times.sort((a, b) => a - b);

      for (let i = 0; i <= times.length - 3; i++) {
        const window = times.filter(t => t >= times[i] && t - times[i] <= 10_000);
        if (window.length >= 3) {
          const [method, ...rest] = key.split(' ');
          const path = rest.join(' ');
          const span = window[window.length - 1] - window[0];
          loops.push({
            method,
            path,
            count: window.length,
            spanMs: span,
            avgIntervalMs: span / (window.length - 1),
            filterQuery: this.pathPrefix(path),
          });
          break;
        }
      }
    }

    return loops.sort((a, b) => b.count - a.count);
  });

  private rawEndpointStats = computed(() => {
    const entries = this.parser.entries();
    if (!entries.length) return [];

    const map = new Map<string, { method: string; path: string; times: number[]; errors: number }>();
    for (const e of entries) {
      const path = normalizeUrlPath(e.request.url);
      const key = `${e.request.method} ${path}`;
      const cur = map.get(key) ?? { method: e.request.method, path, times: [], errors: 0 };
      cur.times.push(e.time);
      if (e.response.status >= 400) cur.errors++;
      map.set(key, cur);
    }

    return [...map.values()].map(ep => {
      const sorted = [...ep.times].sort((a, b) => a - b);
      const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      return {
        method: ep.method,
        path: ep.path,
        count: ep.times.length,
        avgTime: avg,
        p95Time: p95,
        errorRate: (ep.errors / ep.times.length) * 100,
        filterQuery: this.pathPrefix(ep.path),
      };
    });
  });

  endpointStats = computed<EndpointStat[]>(() => {
    const rows = this.rawEndpointStats();
    const field = this.sortField();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = field === 'path' ? a.path : a[field];
      const bv = field === 'path' ? b.path : b[field];
      return typeof av === 'string'
        ? dir * av.localeCompare(bv as string)
        : dir * ((av as number) - (bv as number));
    });
  });

  setSort(field: SortField) {
    if (this.sortField() === field) {
      this.sortDir.update(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('desc');
    }
  }

  sortIcon(field: SortField): string {
    if (this.sortField() !== field) return 'unfold_more';
    return this.sortDir() === 'desc' ? 'arrow_downward' : 'arrow_upward';
  }

  errorRateClass(rate: number): string {
    if (rate >= 20) return 'rate-high';
    if (rate >= 5)  return 'rate-mid';
    return 'rate-ok';
  }

  formatTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  private pathPrefix(normalizedPath: string): string {
    const parts = normalizedPath.split('/');
    const prefix: string[] = [];
    for (const p of parts) {
      if (p === '{id}') break;
      prefix.push(p);
    }
    return prefix.join('/') || normalizedPath;
  }
}
