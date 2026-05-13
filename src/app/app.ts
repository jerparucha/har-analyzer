import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { UploadComponent } from './components/upload/upload.component';
import { SummaryComponent } from './components/summary/summary.component';
import { RequestTableComponent } from './components/request-table/request-table.component';
import { RequestInspectorComponent } from './components/request-inspector/request-inspector.component';
import { WaterfallComponent } from './components/waterfall/waterfall.component';
import { PerformanceComponent } from './components/performance/performance.component';
import { SecurityComponent } from './components/security/security.component';
import { HarParserService } from './services/har-parser.service';
import { HarEntry } from './models/har.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatTabsModule,
    UploadComponent,
    SummaryComponent,
    RequestTableComponent,
    RequestInspectorComponent,
    WaterfallComponent,
    PerformanceComponent,
    SecurityComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private parser = inject(HarParserService);
  hasFile = this.parser.harFile;
  selectedEntry: HarEntry | null = null;
  activeTab = signal(0);
  domainFilter = signal('');

  onDomainSelected(domain: string) {
    this.domainFilter.set(domain);
    this.activeTab.set(4); // Requests tab
  }

  reset() {
    this.selectedEntry = null;
    this.domainFilter.set('');
    this.activeTab.set(0);
    this.parser.reset();
  }
}
