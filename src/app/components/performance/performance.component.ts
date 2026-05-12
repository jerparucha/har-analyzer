import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { PerformanceService } from '../../services/performance.service';

@Component({
  selector: 'app-performance',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatIconModule, MatInputModule, MatFormFieldModule,
    MatSliderModule, MatChipsModule, MatTooltipModule,
    MatExpansionModule, MatBadgeModule,
  ],
  templateUrl: './performance.component.html',
  styleUrl: './performance.component.scss',
})
export class PerformanceComponent {
  svc = inject(PerformanceService);

  get threshold() { return this.svc.slowThresholdMs(); }
  set threshold(v: number) { this.svc.slowThresholdMs.set(v); }

  get slowRequests() { return this.svc.slowRequests(); }
  get duplicateGroups() { return this.svc.duplicateGroups(); }

  statusClass(status: number): string {
    if (status >= 500) return 'status-5xx';
    if (status >= 400) return 'status-4xx';
    if (status >= 300) return 'status-3xx';
    return 'status-2xx';
  }

  formatTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  thresholdLabel(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }
}
