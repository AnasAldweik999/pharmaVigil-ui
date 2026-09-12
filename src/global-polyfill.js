// sockjs-client (pulled in transitively for the notification WebSocket
// connection) references Node's `global` at module load time — e.g.
// `module.exports = global.location || {...}` — which doesn't exist in a
// real browser (only `window`/`globalThis` do). Without this, just
// *importing* it throws "ReferenceError: global is not defined" before the
// app ever renders.
//
// This has to be a classic (non-module) script wired in via angular.json's
// top-level "scripts" array, not a regular TS import: dev/prod bundlers are
// free to split shared modules (like NotificationService, which pulls in
// sockjs-client) into their own chunk, whose import can get hoisted ahead of
// a same-graph polyfill import regardless of source order. A classic script
// is guaranteed by the HTML spec to finish running before any `type=module`
// script starts, independent of how the module graph gets chunked.
if (typeof globalThis.global === 'undefined') {
  globalThis.global = globalThis;
}
