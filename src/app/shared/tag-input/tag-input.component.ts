import { Component, ElementRef, Input, ViewChild, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-tag-input',
  imports: [TranslatePipe],
  templateUrl: './tag-input.component.html',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TagInputComponent), multi: true },
  ],
})
export class TagInputComponent implements ControlValueAccessor {
  @Input() placeholder = '';
  @Input() maxLength = 255;

  @ViewChild('input') private inputRef!: ElementRef<HTMLInputElement>;

  readonly tags = signal<string[]>([]);
  readonly inputValue = signal('');
  readonly disabled = signal(false);

  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string[] | null): void {
    this.tags.set(value ? [...value] : []);
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  focusInput(): void {
    this.inputRef.nativeElement.focus();
  }

  onInputChange(value: string): void {
    this.inputValue.set(value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commit();
    } else if (event.key === 'Backspace' && this.inputValue() === '' && this.tags().length > 0) {
      this.removeAt(this.tags().length - 1);
    }
  }

  onBlur(): void {
    this.commit();
    this.onTouched();
  }

  removeAt(index: number): void {
    this.tags.update((tags) => tags.filter((_, i) => i !== index));
    this.onChange(this.tags());
    this.onTouched();
  }

  private commit(): void {
    const value = this.inputValue().trim().slice(0, this.maxLength);
    this.inputValue.set('');
    if (!value) return;
    const exists = this.tags().some((t) => t.toLowerCase() === value.toLowerCase());
    if (exists) return;
    this.tags.update((tags) => [...tags, value]);
    this.onChange(this.tags());
  }
}
