import { Component, inject, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HarParserService } from '../../services/har-parser.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent {
  private parser = inject(HarParserService);

  fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  isDragOver = false;
  isLoading = false;

  get error() { return this.parser.error(); }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave() {
    this.isDragOver = false;
  }

  async onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) await this.processFile(file);
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processFile(file);
  }

  openPicker() {
    this.fileInput().nativeElement.click();
  }

  private async processFile(file: File) {
    if (!file.name.endsWith('.har') && !['application/json', 'application/har+json', 'text/plain'].includes(file.type)) {
      this.parser.error.set('Please select a valid .har file');
      return;
    }
    this.isLoading = true;
    await this.parser.loadFile(file);
    this.isLoading = false;
  }
}
