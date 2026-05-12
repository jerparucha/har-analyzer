import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { SecurityService, Severity } from '../../services/security.service';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatExpansionModule, MatTooltipModule, MatChipsModule],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss',
})
export class SecurityComponent {
  svc = inject(SecurityService);

  get findings() { return this.svc.findings(); }
  get summary()  { return this.svc.summary(); }

  severityIcon(s: Severity): string {
    return { high: 'error', medium: 'warning', low: 'info', info: 'tips_and_updates' }[s];
  }

  severityLabel(s: Severity): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
