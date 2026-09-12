import { AccountType } from '../models/role.models';
import { NotificationItem } from '../models/notification.models';

// Maps a notification's `entityType` to an in-app route for its entity, per
// portal. No real notification-raising feature exists yet, so this registry
// intentionally starts empty rather than guessing a mapping — e.g. a naive
// `BATCH -> /staff/batches/:entityId` entry would be wrong today, since batch
// detail routes are keyed by `batchNo`, not the entity's id, and there's no
// lookup endpoint to resolve one to the other. Add an entry here once a real
// feature defines what `entityId` actually contains for its `entityType`.
const ENTITY_ROUTES: Record<string, (entityId: string, portal: AccountType) => string[]> = {};

export function resolveNotificationLink(notification: NotificationItem, portal: AccountType): string[] | null {
  if (!notification.entityType || !notification.entityId) return null;
  const resolver = ENTITY_ROUTES[notification.entityType];
  return resolver ? resolver(notification.entityId, portal) : null;
}
