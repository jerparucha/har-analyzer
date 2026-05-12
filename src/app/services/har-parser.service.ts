import { Injectable, signal } from '@angular/core';
import { HarFile, HarEntry, HarSummary, ContentBreakdown, TypeStats } from '../models/har.model';

@Injectable({ providedIn: 'root' })
export class HarParserService {
  readonly harFile = signal<HarFile | null>(null);
  readonly entries = signal<HarEntry[]>([]);
  readonly summary = signal<HarSummary | null>(null);
  readonly fileName = signal<string>('');
  readonly error = signal<string>('');

  async loadFile(file: File): Promise<void> {
    this.error.set('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as HarFile;
      this.validate(parsed);
      this.harFile.set(parsed);
      this.fileName.set(file.name);
      const entries = parsed.log.entries ?? [];
      this.entries.set(entries);
      this.summary.set(this.computeSummary(parsed));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to parse HAR file');
      this.harFile.set(null);
      this.entries.set([]);
      this.summary.set(null);
    }
  }

  reset(): void {
    this.harFile.set(null);
    this.entries.set([]);
    this.summary.set(null);
    this.fileName.set('');
    this.error.set('');
  }

  private validate(data: unknown): void {
    if (!data || typeof data !== 'object') throw new Error('Invalid HAR: not a JSON object');
    const obj = data as Record<string, unknown>;
    if (!obj['log']) throw new Error('Invalid HAR: missing "log" property');
    const log = obj['log'] as Record<string, unknown>;
    if (!Array.isArray(log['entries'])) throw new Error('Invalid HAR: "log.entries" must be an array');
  }

  private computeSummary(har: HarFile): HarSummary {
    const entries = har.log.entries;
    const breakdown = this.initBreakdown();

    let totalSize = 0;
    let totalTransferSize = 0;
    let totalTime = 0;
    let failedRequests = 0;

    for (const entry of entries) {
      const contentSize = entry.response.content.size ?? 0;
      const bodySize = entry.response.bodySize ?? 0;
      totalSize += contentSize > 0 ? contentSize : 0;
      totalTransferSize += bodySize > 0 ? bodySize : 0;
      totalTime += entry.time ?? 0;
      if (entry.response.status >= 400) failedRequests++;

      const bucket = this.getBucket(entry);
      breakdown[bucket].count++;
      breakdown[bucket].size += contentSize > 0 ? contentSize : 0;
    }

    return {
      totalRequests: entries.length,
      totalSize,
      totalTransferSize,
      totalTime,
      failedRequests,
      pageCount: har.log.pages?.length ?? 0,
      startedAt: entries[0]?.startedDateTime ?? '',
      breakdown,
    };
  }

  private getBucket(entry: HarEntry): keyof ContentBreakdown {
    const mime = entry.response.content.mimeType?.toLowerCase() ?? '';
    const resourceType = entry._resourceType?.toLowerCase() ?? '';
    const url = entry.request.url.toLowerCase();

    if (resourceType === 'xhr' || resourceType === 'fetch') return 'xhr';
    if (mime.includes('html')) return 'html';
    if (mime.includes('javascript') || mime.includes('ecmascript') || url.endsWith('.js')) return 'javascript';
    if (mime.includes('css') || url.endsWith('.css')) return 'css';
    if (mime.includes('image') || /\.(png|jpg|jpeg|gif|svg|webp|ico)/.test(url)) return 'images';
    if (mime.includes('font') || /\.(woff2?|ttf|eot|otf)/.test(url)) return 'fonts';
    if (mime.includes('json') || mime.includes('xml')) return 'xhr';
    return 'other';
  }

  private initBreakdown(): ContentBreakdown {
    const empty = (): TypeStats => ({ count: 0, size: 0 });
    return {
      html: empty(), javascript: empty(), css: empty(),
      images: empty(), fonts: empty(), xhr: empty(), other: empty(),
    };
  }
}
