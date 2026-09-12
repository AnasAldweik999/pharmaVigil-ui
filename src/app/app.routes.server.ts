import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Server-rendered (not prerendered) so the locale cookie / Accept-Language
  // header can be read per-request and the correct language/direction is
  // sent on first byte — prerendering has no live request to read.
  { path: 'login',          renderMode: RenderMode.Server },
  { path: 'reset-password', renderMode: RenderMode.Server },
  { path: 'setup-username', renderMode: RenderMode.Server },
  { path: 'supervisor/**',  renderMode: RenderMode.Client },
  { path: 'staff/**',       renderMode: RenderMode.Client },
  { path: '**',             renderMode: RenderMode.Prerender },
];
