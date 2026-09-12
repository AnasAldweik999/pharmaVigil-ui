import { HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

interface SpringPagedModel {
  content: unknown[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
}

function isSpringPagedModel(body: unknown): body is SpringPagedModel {
  if (body === null || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b['content']) || typeof b['page'] !== 'object' || b['page'] === null) return false;
  const page = b['page'] as Record<string, unknown>;
  return typeof page['size'] === 'number' && typeof page['number'] === 'number'
    && typeof page['totalElements'] === 'number' && typeof page['totalPages'] === 'number';
}

/**
 * Spring Boot serializes `Page<T>` via `PagedModel` ({content, page:{size,number,totalElements,totalPages}})
 * since `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)` was added on the backend.
 * Flattens that shape back to the legacy `Page<T>` shape the app is built against.
 */
export const paginationInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map((event: HttpEvent<unknown>) => {
      if (event instanceof HttpResponse && isSpringPagedModel(event.body)) {
        const { content, page } = event.body;
        return event.clone({
          body: {
            content,
            size: page.size,
            number: page.number,
            totalElements: page.totalElements,
            totalPages: page.totalPages,
            first: page.number === 0,
            last: page.number >= page.totalPages - 1,
            empty: content.length === 0,
          },
        });
      }
      return event;
    }),
  );
};
