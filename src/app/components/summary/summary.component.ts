import { Component, inject, computed } from '@angular/core';
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
