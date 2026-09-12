import { ValidatorFn, Validators } from '@angular/forms';

export const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;

export const usernameValidators: ValidatorFn[] = [
  Validators.required,
  Validators.maxLength(255),
  Validators.pattern(USERNAME_PATTERN),
];
