import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HarParserService } from '../../services/har-parser.service';

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTooltipModule],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.scss',
})
export class SummaryComponent {
  private parser = inject(HarParserService);

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

  breakdown = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const b = s.breakdown;
    return [
      { label: 'HTML', ...b.html, color: '#f44336' },
      { label: 'JavaScript', ...b.javascript, color: '#ff9800' },
      { label: 'CSS', ...b.css, color: '#2196f3' },
      { label: 'Images', ...b.images, color: '#4caf50' },
      { label: 'Fonts', ...b.fonts, color: '#9c27b0' },
      { label: 'XHR/Fetch', ...b.xhr, color: '#00bcd4' },
      { label: 'Other', ...b.other, color: '#9e9e9e' },
    ].filter(b => b.count > 0);
  });

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
}
