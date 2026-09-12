import { Component, ElementRef, HostListener, Input, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-user-menu',
  imports: [TranslatePipe],
  templateUrl: './user-menu.component.html',
})
export class UserMenuComponent {
  @Input({ required: true }) roleLabelKey!: string;

  private readonly authService = inject(AuthService);
  private readonly elementRef = inject(ElementRef);

  readonly name = this.authService.currentName;
  readonly email = this.authService.currentEmail;
  readonly username = this.authService.currentUsername;
  readonly initials = computed(() =>
    (this.name() ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join(''),
  );

  readonly open = signal(false);

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
