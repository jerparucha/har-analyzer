import { Component, inject, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HarParserService } from '../../services/har-parser.service';

interface BreakdownItem {
  label: string;
  color: string;
  count: number;
  size: number;
}

interface ChartSegment {
  label: string;
  color: string;
  pct: number;
  dash: number;
  offset: number;
  formattedValue: string;
}

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTooltipModule],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.scss',
})
export class SummaryComponent {
  private parser = inject(HarParserService);
  @Output() domainSelected = new EventEmitter<string>();

  readonly circ = 2 * Math.PI * 60;

  summary = this.parser.summary;
  fileName = this.parser.fileName;

  stats = computed(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Requests', value: s.totalRequests.toString(), icon: 'http', color: '#3f51b5' },
      { label: 'Total Size', value: this.formatBytes(s.totalSize), icon: 'data_usage', color: '#009688' },
      { label: 'Total Time', value: this.formatTime(s.totalTime), icon: 'schedule', color: '#ff9800' },
      { label: 'Failed', value: s.failedRequests.toString(), icon: 'error_outline', color: s.failedRequests > 0 ? '#f44336' : '#4caf50' },
      { label: 'Pages', value: s.pageCount.toString(), icon: 'web', color: '#9c27b0' },
    ];
  });

  private baseBreakdown = computed<BreakdownItem[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const b = s.breakdown;
    return ([
      { label: 'HTML',       color: '#f44336', ...b.html },
      { label: 'JavaScript', color: '#ff9800', ...b.javascript },
      { label: 'CSS',        color: '#2196f3', ...b.css },
      { label: 'Images',     color: '#4caf50', ...b.images },
      { label: 'Fonts',      color: '#9c27b0', ...b.fonts },
      { label: 'XHR/Fetch',  color: '#00bcd4', ...b.xhr },
      { label: 'Other',      color: '#9e9e9e', ...b.other },
    ] as BreakdownItem[]).filter(item => item.count > 0);
  });

  breakdown = computed(() => {
    const items = this.baseBreakdown();
    const totalCount = items.reduce((s, i) => s + i.count, 0);
    const totalSize  = items.reduce((s, i) => s + i.size,  0);
    return items.map(item => ({
      ...item,
      countPct: totalCount ? (item.count / totalCount) * 100 : 0,
      sizePct:  totalSize  ? (item.size  / totalSize)  * 100 : 0,
    }));
  });

  chartByCount = computed<ChartSegment[]>(() => {
    const items = this.baseBreakdown();
    const total = items.reduce((s, i) => s + i.count, 0);
    return this.toSegments(items, total, i => i.count, v => `${v} req`);
  });

  chartBySize = computed<ChartSegment[]>(() => {
    const items = this.baseBreakdown();
    const total = items.reduce((s, i) => s + i.size, 0);
    return this.toSegments(items, total, i => i.size, v => this.formatBytes(v));
  });

  totalCountLabel = computed(() => {
    return this.baseBreakdown().reduce((s, i) => s + i.count, 0).toString();
  });

  totalSizeLabel = computed(() => {
    return this.formatBytes(this.baseBreakdown().reduce((s, i) => s + i.size, 0));
  });

  thirdPartyData = computed(() => {
    const entries = this.parser.entries();
    if (!entries.length) return null;

    const domainMap = new Map<string, { count: number; size: number; totalTime: number }>();
    for (const e of entries) {
      let domain = '';
      try { domain = new URL(e.request.url).hostname; } catch { continue; }
      if (!domain) continue;
      const cur = domainMap.get(domain) ?? { count: 0, size: 0, totalTime: 0 };
      cur.count++;
      cur.size += e.response.content.size > 0 ? e.response.content.size : e.response.bodySize;
      cur.totalTime += e.time;
      domainMap.set(domain, cur);
    }

    const firstParty = [...domainMap.entries()].sort((a, b) => b[1].count - a[1].count)[0]?.[0] ?? '';
    const grandTotal = [...domainMap.values()].reduce((s, d) => s + d.totalTime, 0) || 1;

    return [...domainMap.entries()]
      .map(([domain, d]) => ({
        domain,
        isFirstParty: domain === firstParty,
        count: d.count,
        totalSize: d.size,
        avgTime: d.totalTime / d.count,
        totalTime: d.totalTime,
        timePct: (d.totalTime / grandTotal) * 100,
      }))
      .sort((a, b) => b.totalTime - a.totalTime);
  });

  healthMetrics = computed(() => {
    const entries = this.parser.entries();
    if (!entries.length) return null;

    const times = entries.map(e => e.time);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    const sortedTimes = [...times].sort((a, b) => a - b);
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

    const failed = entries.filter(e => e.response.status >= 400);
    const errorRate = (failed.length / entries.length) * 100;

    const pathTimes = new Map<string, number[]>();
    for (const e of entries) {
      try {
        const path = new URL(e.request.url).pathname;
        const bucket = pathTimes.get(path) ?? [];
        bucket.push(e.time);
        pathTimes.set(path, bucket);
      } catch { /* skip */ }
    }
    let slowestPath = '—';
    let slowestAvg = 0;
    for (const [path, t] of pathTimes) {
      const a = t.reduce((s, v) => s + v, 0) / t.length;
      if (a > slowestAvg) { slowestAvg = a; slowestPath = path; }
    }

    let topError = '—';
    if (failed.length) {
      const counts = new Map<string, number>();
      for (const e of failed) {
        const key = `${e.response.status} ${e.response.statusText}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const [code, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      topError = `${code} (${count}×)`;
    }

    return {
      avg: this.formatTime(avg),
      p95: this.formatTime(p95),
      errorRate: `${errorRate.toFixed(1)}%`,
      errorRateHigh: errorRate >= 5,
      slowestPath,
      topError,
    };
  });

  private toSegments(
    items: BreakdownItem[],
    total: number,
    valFn: (i: BreakdownItem) => number,
    fmtFn: (v: number) => string,
  ): ChartSegment[] {
    if (!total) return [];
    let cum = 0;
    return items.map(item => {
      const v    = valFn(item);
      const pct  = v / total;
      const dash = pct * this.circ;
      const offset = -(cum * this.circ);
      cum += pct;
      return { label: item.label, color: item.color, pct, dash, offset, formattedValue: fmtFn(v) };
    });
  }

  formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  formatTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  formatPct(pct: number): string {
    return `${Math.round(pct * 100)}%`;
  }
}
