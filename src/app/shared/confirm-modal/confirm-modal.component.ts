import { Component, ElementRef, EventEmitter, inject, Input, Output, PLATFORM_ID, signal, ViewChild } from '@angular/core';
import { isPlatformBrowser, NgClass } from '@angular/common';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-confirm-modal',
  imports: [NgClass, TranslatePipe],
  templateUrl: './confirm-modal.component.html',
})
export class ConfirmModalComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translation = inject(TranslationService);

  @Input() title = '';
  @Input() confirmLabel = '';
  @Input() confirmBtnClass = 'btn-danger';

  get resolvedTitle(): string { return this.title || this.translation.t('grid.confirm'); }
  get resolvedConfirmLabel(): string { return this.confirmLabel || this.translation.t('common.delete'); }
  @Output() confirmed = new EventEmitter<void>();

  @ViewChild('confirmModalRef') private modalRef!: ElementRef<HTMLElement>;
  private bsModal: { show(): void; hide(): void } | null = null;

  readonly message = signal('');
  readonly warning = signal('');

  open(message: string, warning = ''): void {
    this.message.set(message);
    this.warning.set(warning);
    this.modal?.show();
  }

  close(): void {
    this.modal?.hide();
  }

  onConfirm(): void {
    this.close();
    this.confirmed.emit();
  }

  private get modal(): { show(): void; hide(): void } | null {
    if (!isPlatformBrowser(this.platformId) || !this.modalRef?.nativeElement) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BootstrapModal = (window as any).bootstrap?.Modal;
    if (!BootstrapModal) return null;
    if (!this.bsModal) {
      this.bsModal = new BootstrapModal(this.modalRef.nativeElement) as { show(): void; hide(): void };
    }
    return this.bsModal;
  }
}
