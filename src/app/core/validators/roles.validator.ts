import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { UserRole } from '../models/role.models';

export const rolesRequiredValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as UserRole[] | null;
  return value && value.length > 0 ? null : { required: true };
};
