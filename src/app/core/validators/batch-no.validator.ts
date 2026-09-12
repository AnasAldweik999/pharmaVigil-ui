import { ValidatorFn, Validators } from '@angular/forms';

export const BATCH_NO_PATTERN = /^[a-zA-Z0-9]+$/;
export const BATCH_NO_MAX_LENGTH = 50;

export const batchNoValidators: ValidatorFn[] = [
  Validators.required,
  Validators.maxLength(BATCH_NO_MAX_LENGTH),
  Validators.pattern(BATCH_NO_PATTERN),
];
