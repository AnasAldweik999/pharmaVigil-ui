import { Component, computed, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-language-switcher',
  templateUrl: './language-switcher.component.html',
})
export class LanguageSwitcherComponent {
  readonly translation = inject(TranslationService);

  // Shows the *other* language's own name — tapping switches to it.
  readonly otherLocale = computed(() => (this.translation.locale() === 'en' ? 'ar' : 'en'));
  readonly otherLocaleName = computed(() => (this.otherLocale() === 'ar' ? 'العربية' : 'English'));

  toggle(): void {
    this.translation.setLocale(this.otherLocale());
  }
}
