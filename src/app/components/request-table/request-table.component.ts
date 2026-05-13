import { Component, inject, OnInit, OnChanges, SimpleChanges, ViewChild, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { HarParserService } from '../../services/har-parser.service';
import { HarEntry } from '../../models/har.model';


interface TableRow {
  index: number;
  method: string;
  url: string;
  domain: string;
  status: number;
  statusText: string;
  type: string;
  size: number;
  time: number;
  startedAt: string;
}

@Component({
  selector: 'app-request-table',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatInputModule, MatFormFieldModule, MatSelectModule,
    MatIconModule, MatButtonModule, MatChipsModule,
    MatTooltipModule, MatBadgeModule,
  ],
  templateUrl: './request-table.component.html',
  styleUrl: './request-table.component.scss',
})
export class RequestTableComponent implements OnInit, OnChanges {
  private parser = inject(HarParserService);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @Output() entrySelected = new EventEmitter<HarEntry>();

  @Input() domainFilter = '';

  selectedIndex: number | null = null;
  medianTime = 0;

  displayedColumns = ['index', 'method', 'status', 'type', 'domain', 'url', 'size', 'time'];

  dataSource = new MatTableDataSource<TableRow>([]);

  private allEntries: HarEntry[] = [];

  searchQuery = '';
  selectedMethods: string[] = [];
  selectedStatuses: string[] = [];
  selectedTypes: string[] = [];

  availableMethods = signal<string[]>([]);
  availableTypes = signal<string[]>([]);

  statusGroups = [
    { label: '2xx Success', value: '2xx' },
    { label: '3xx Redirect', value: '3xx' },
    { label: '4xx Client Error', value: '4xx' },
    { label: '5xx Server Error', value: '5xx' },
  ];

  activeFilterCount = computed(() =>
    (this.selectedMethods.length > 0 ? 1 : 0) +
    (this.selectedStatuses.length > 0 ? 1 : 0) +
    (this.selectedTypes.length > 0 ? 1 : 0) +
    (this.searchQuery.trim() ? 1 : 0)
  );

  ngOnChanges(changes: SimpleChanges) {
    if (changes['domainFilter'] && this.dataSource.data.length) {
      this.searchQuery = this.domainFilter;
      this.applyFilters();
    }
  }

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  onSearchChange() {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.applyFilters(), 300);
  }

  ngOnInit() {
    this.allEntries = this.parser.entries();
    const rows = this.allEntries.map((entry, i) => this.toRow(entry, i));
    this.dataSource.data = rows;

    this.availableMethods.set([...new Set(rows.map(r => r.method))].sort());
    this.availableTypes.set([...new Set(rows.map(r => r.type))].sort());

    const sorted = [...rows].sort((a, b) => a.time - b.time);
    const mid = Math.floor(sorted.length / 2);
    this.medianTime = sorted.length % 2 !== 0
      ? sorted[mid].time
      : (sorted[mid - 1].time + sorted[mid].time) / 2;

    this.dataSource.filterPredicate = this.buildFilterPredicate();

    setTimeout(() => {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.dataSource.sortingDataAccessor = (row, col) => {
        switch (col) {
          case 'size': return row.size;
          case 'time': return row.time;
          default: return (row as unknown as Record<string, string>)[col] ?? '';
        }
      };
    });
  }

  selectRow(row: TableRow) {
    this.selectedIndex = row.index;
    this.entrySelected.emit(this.allEntries[row.index - 1]);
  }

  applyFilters() {
    const filter = JSON.stringify({
      q: this.searchQuery.toLowerCase().trim(),
      methods: this.selectedMethods,
      statuses: this.selectedStatuses,
      types: this.selectedTypes,
    });
    this.dataSource.filter = filter;
    this.dataSource.paginator?.firstPage();
  }

  clearFilters() {
    this.searchQuery = '';
    this.selectedMethods = [];
    this.selectedStatuses = [];
    this.selectedTypes = [];
    this.applyFilters();
  }

  statusClass(status: number): string {
    if (status >= 500) return 'status-5xx';
    if (status >= 400) return 'status-4xx';
    if (status >= 300) return 'status-3xx';
    if (status >= 200) return 'status-2xx';
    return '';
  }

  formatBytes(bytes: number): string {
    if (bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  shortUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.pathname + (u.search ? u.search : '');
    } catch {
      return url;
    }
  }

  private toRow(entry: HarEntry, index: number): TableRow {
    let domain = '';
    try { domain = new URL(entry.request.url).hostname; } catch { domain = '—'; }

    const mime = entry.response.content.mimeType?.toLowerCase() ?? '';
    const resourceType = entry._resourceType?.toLowerCase() ?? '';
    const url = entry.request.url.toLowerCase();
    let type = 'other';
    if (resourceType === 'xhr' || resourceType === 'fetch' || mime.includes('json') || mime.includes('xml')) type = 'xhr/fetch';
    else if (mime.includes('html')) type = 'html';
    else if (mime.includes('javascript') || mime.includes('ecmascript') || url.endsWith('.js')) type = 'js';
    else if (mime.includes('css') || url.endsWith('.css')) type = 'css';
    else if (mime.includes('image') || /\.(png|jpg|jpeg|gif|svg|webp|ico)/.test(url)) type = 'image';
    else if (mime.includes('font') || /\.(woff2?|ttf|eot|otf)/.test(url)) type = 'font';

    return {
      index: index + 1,
      method: entry.request.method,
      url: entry.request.url,
      domain,
      status: entry.response.status,
      statusText: entry.response.statusText,
      type,
      size: entry.response.content.size > 0 ? entry.response.content.size : entry.response.bodySize,
      time: entry.time,
      startedAt: entry.startedDateTime,
    };
  }

  exportCsv() {
    const rows = this.dataSource.filteredData;
    const header = ['#', 'Method', 'URL', 'Domain', 'Status', 'Status Text', 'Type', 'Size (bytes)', 'Time (ms)', 'Started At'];
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      header.join(','),
      ...rows.map(r => [r.index, r.method, r.url, r.domain, r.status, r.statusText, r.type, r.size, r.time, r.startedAt].map(escape).join(',')),
    ];
    this.download(lines.join('\r\n'), 'har-export.csv', 'text/csv');
  }

  exportJson() {
    const rows = this.dataSource.filteredData.map(r => ({
      index: r.index,
      method: r.method,
      url: r.url,
      domain: r.domain,
      status: r.status,
      statusText: r.statusText,
      type: r.type,
      sizeBytes: r.size,
      timeMs: r.time,
      startedAt: r.startedAt,
    }));
    this.download(JSON.stringify(rows, null, 2), 'har-export.json', 'application/json');
  }

  private download(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private buildFilterPredicate() {
    return (row: TableRow, filter: string): boolean => {
      const f = JSON.parse(filter);
      if (f.q && !row.url.toLowerCase().includes(f.q) && !row.domain.toLowerCase().includes(f.q)) return false;
      if (f.methods.length && !f.methods.includes(row.method)) return false;
      if (f.types.length && !f.types.includes(row.type)) return false;
      if (f.statuses.length) {
        const match = f.statuses.some((s: string) => {
          const prefix = parseInt(s[0]);
          return Math.floor(row.status / 100) === prefix;
        });
        if (!match) return false;
      }
      return true;
    };
  }
}
