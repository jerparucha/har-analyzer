import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';
import { HarParserService } from '../../services/har-parser.service';
import { HarEntry } from '../../models/har.model';

interface WaterfallRow {
  index: number;
  url: string;
  shortUrl: string;
  domain: string;
  method: string;
  status: number;
  startMs: number;       // ms from first request
  totalMs: number;       // total duration
  phases: Phase[];
}

interface Phase {
  label: string;
  durationMs: number;
  color: string;
  offsetPct: number;
  widthPct: number;
}

const PHASE_COLORS: Record<string, string> = {
  blocked: '#9e9e9e',
  dns:     '#4caf50',
  connect: '#ff9800',
  ssl:     '#f44336',
  send:    '#2196f3',
  wait:    '#9c27b0',
  receive: '#00bcd4',
};

@Component({
  selector: 'app-waterfall',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, MatIconModule, MatButtonModule, MatSliderModule, FormsModule],
  templateUrl: './waterfall.component.html',
  styleUrl: './waterfall.component.scss',
})
export class WaterfallComponent {
  private parser = inject(HarParserService);

  rowHeight = signal(44);
  labelWidth = 340;

  legendItems = Object.entries(PHASE_COLORS).map(([key, color]) => ({
    label: key.charAt(0).toUpperCase() + key.slice(1),
    color,
  }));

  rows = computed<WaterfallRow[]>(() => {
    const entries = this.parser.entries();
    if (!entries.length) return [];

    const t0 = new Date(entries[0].startedDateTime).getTime();
    const totalSpan = this.totalSpan(entries, t0);

    return entries.map((entry, i) => {
      const startMs = new Date(entry.startedDateTime).getTime() - t0;
      const t = entry.timings;
      const phases = this.buildPhases(t, startMs, totalSpan);

      let domain = '';
      try { domain = new URL(entry.request.url).hostname; } catch { domain = ''; }

      let shortUrl = entry.request.url;
      try {
        const u = new URL(entry.request.url);
        shortUrl = u.pathname + (u.search || '');
      } catch { /* keep full url */ }

      return {
        index: i + 1,
        url: entry.request.url,
        shortUrl,
        domain,
        method: entry.request.method,
        status: entry.response.status,
        startMs,
        totalMs: entry.time,
        phases,
      };
    });
  });

  totalSpanMs = computed(() => {
    const entries = this.parser.entries();
    if (!entries.length) return 0;
    const t0 = new Date(entries[0].startedDateTime).getTime();
    return this.totalSpan(entries, t0);
  });

  tickMarks = computed(() => {
    const span = this.totalSpanMs();
    if (!span) return [];
    const count = 6;
    return Array.from({ length: count + 1 }, (_, i) => ({
      pct: (i / count) * 100,
      label: this.formatTime((i / count) * span),
    }));
  });

  statusClass(status: number): string {
    if (status >= 500) return 'status-5xx';
    if (status >= 400) return 'status-4xx';
    if (status >= 300) return 'status-3xx';
    return 'status-2xx';
  }

  formatTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  phaseTooltip(phase: Phase): string {
    return `${phase.label}: ${this.formatTime(phase.durationMs)}`;
  }

  rowTooltip(row: WaterfallRow): string {
    return `${row.method} ${row.url}\nStart: ${this.formatTime(row.startMs)} | Duration: ${this.formatTime(row.totalMs)}`;
  }

  private totalSpan(entries: HarEntry[], t0: number): number {
    let max = 0;
    for (const e of entries) {
      const start = new Date(e.startedDateTime).getTime() - t0;
      const end = start + e.time;
      if (end > max) max = end;
    }
    return max || 1;
  }

  private buildPhases(
    t: HarEntry['timings'],
    startMs: number,
    totalSpan: number,
  ): Phase[] {
    const raw = [
      { label: 'Blocked', key: 'blocked', value: t.blocked ?? 0 },
      { label: 'DNS',     key: 'dns',     value: t.dns     ?? 0 },
      { label: 'Connect', key: 'connect', value: t.connect ?? 0 },
      { label: 'SSL',     key: 'ssl',     value: t.ssl     ?? 0 },
      { label: 'Send',    key: 'send',    value: t.send },
      { label: 'Wait',    key: 'wait',    value: t.wait },
      { label: 'Receive', key: 'receive', value: t.receive },
    ].filter(p => p.value > 0);

    let cursor = startMs;
    return raw.map(p => {
      const offsetPct = (cursor / totalSpan) * 100;
      const widthPct  = (p.value / totalSpan) * 100;
      cursor += p.value;
      return {
        label: p.label,
        durationMs: p.value,
        color: PHASE_COLORS[p.key],
        offsetPct,
        widthPct: Math.max(widthPct, 0.15),
      };
    });
  }
}
