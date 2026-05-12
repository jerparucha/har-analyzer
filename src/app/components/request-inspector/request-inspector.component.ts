import { Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { HarEntry, HarHeader, HarCookie } from '../../models/har.model';

@Component({
  selector: 'app-request-inspector',
  standalone: true,
  imports: [
    CommonModule, MatTabsModule, MatIconModule,
    MatButtonModule, MatTooltipModule, MatChipsModule,
  ],
  templateUrl: './request-inspector.component.html',
  styleUrl: './request-inspector.component.scss',
})
export class RequestInspectorComponent {
  @Input() set entry(val: HarEntry | null) {
    this._entry.set(val);
  }
  @Output() closed = new EventEmitter<void>();

  _entry = signal<HarEntry | null>(null);

  overview = computed(() => {
    const e = this._entry();
    if (!e) return null;
    let domain = '';
    try { domain = new URL(e.request.url).hostname; } catch { domain = '—'; }
    return {
      method: e.request.method,
      url: e.request.url,
      domain,
      status: e.response.status,
      statusText: e.response.statusText,
      httpVersion: e.response.httpVersion,
      mimeType: e.response.content.mimeType,
      size: e.response.content.size,
      transferSize: e.response.bodySize,
      time: e.time,
      startedAt: e.startedDateTime,
      serverIp: e.serverIPAddress ?? '—',
    };
  });

  timings = computed(() => {
    const e = this._entry();
    if (!e) return [];
    const t = e.timings;
    const total = e.time;
    const phases = [
      { label: 'Blocked',  value: t.blocked  ?? 0, color: '#9e9e9e' },
      { label: 'DNS',      value: t.dns      ?? 0, color: '#4caf50' },
      { label: 'Connect',  value: t.connect  ?? 0, color: '#ff9800' },
      { label: 'SSL',      value: t.ssl      ?? 0, color: '#f44336' },
      { label: 'Send',     value: t.send,          color: '#2196f3' },
      { label: 'Wait',     value: t.wait,          color: '#9c27b0' },
      { label: 'Receive',  value: t.receive,       color: '#00bcd4' },
    ].filter(p => p.value > 0);
    return phases.map(p => ({ ...p, pct: total > 0 ? (p.value / total) * 100 : 0 }));
  });

  queryParams = computed(() => this._entry()?.request.queryString ?? []);
  reqHeaders  = computed(() => this._entry()?.request.headers ?? []);
  resHeaders  = computed(() => this._entry()?.response.headers ?? []);
  reqCookies  = computed(() => this._entry()?.request.cookies ?? []);
  resCookies  = computed(() => this._entry()?.response.cookies ?? []);

  responseBody = computed(() => {
    const text = this._entry()?.response.content.text;
    if (!text) return null;
    const mime = this._entry()?.response.content.mimeType ?? '';
    if (mime.includes('json')) {
      try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
    }
    return text;
  });

  requestBody = computed(() => {
    const pd = this._entry()?.request.postData;
    if (!pd) return null;
    if (pd.text) {
      if (pd.mimeType?.includes('json')) {
        try { return JSON.stringify(JSON.parse(pd.text), null, 2); } catch { return pd.text; }
      }
      return pd.text;
    }
    if (pd.params?.length) {
      return pd.params.map(p => `${p.name}=${p.value ?? ''}`).join('\n');
    }
    return null;
  });

  statusClass(status: number): string {
    if (status >= 500) return 'status-5xx';
    if (status >= 400) return 'status-4xx';
    if (status >= 300) return 'status-3xx';
    return 'status-2xx';
  }

  formatBytes(bytes: number): string {
    if (bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  formatTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  trackByName(_: number, item: HarHeader | HarCookie) { return item.name; }
}
