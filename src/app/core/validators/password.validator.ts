import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const SPECIAL_CHARS = /[@$!%*?&_#^()\-+=]/;

export const passwordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = (control.value as string) ?? '';
  if (!value) return null;

  const errors: ValidationErrors = {};
  if (value.length < 8)            errors['minLength']    = true;
  if (!/[A-Z]/.test(value))        errors['uppercase']    = true;
  if (!/[a-z]/.test(value))        errors['lowercase']    = true;
  if (!/[0-9]/.test(value))        errors['number']       = true;
  if (!SPECIAL_CHARS.test(value))  errors['specialChar']  = true;

  return Object.keys(errors).length ? errors : null;
};

export interface PasswordRule {
  labelKey: string;
  met: boolean;
}

export function getPasswordRules(value: string): PasswordRule[] {
  return [
    { labelKey: 'auth.resetPassword.rules.minLength',   met: value.length >= 8 },
    { labelKey: 'auth.resetPassword.rules.uppercase',   met: /[A-Z]/.test(value) },
    { labelKey: 'auth.resetPassword.rules.lowercase',   met: /[a-z]/.test(value) },
    { labelKey: 'auth.resetPassword.rules.number',      met: /[0-9]/.test(value) },
    { labelKey: 'auth.resetPassword.rules.specialChar', met: SPECIAL_CHARS.test(value) },
  ];
}
