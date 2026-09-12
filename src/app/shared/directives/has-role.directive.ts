import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.models';

@Directive({ selector: '[appHasRole]' })
export class HasRoleDirective {
  private readonly authService = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly roles = signal<UserRole[]>([]);
  private hasView = false;

  @Input() set appHasRole(value: UserRole | UserRole[] | undefined | null) {
    this.roles.set(value ? (Array.isArray(value) ? value : [value]) : []);
  }

  constructor() {
    effect(() => {
      const allowed = this.roles().length === 0 || this.authService.hasAnyRole(...this.roles());
      if (allowed && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
