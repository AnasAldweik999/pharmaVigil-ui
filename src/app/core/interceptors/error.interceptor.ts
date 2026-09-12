import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { TranslationService } from '../services/translation.service';
import { extractErrorMessage } from '../utils/api-error.util';
import { SUPPRESS_ERROR_TOAST } from './error-toast.tokens';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);
  const translation = inject(TranslationService);
  return next(req).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status !== 401 && !req.context.get(SUPPRESS_ERROR_TOAST)) {
        if (err.status === 400) {
          toastService.error(extractErrorMessage(err, (code) => translation.errorMessage(code), 'generic', (v) => translation.violatorLabel(v)));
        } else {
          toastService.error(translation.errorMessage('generic'));
        }
      }
      return throwError(() => err);
    }),
  );
};
