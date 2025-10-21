# workflow-adapter

Portable workflow engine extracted from plateforme-impression-v2.

- Statuses: PREPARATION, READY, IN_PROGRESS, COMPLETED, IN_DELIVERY, DELIVERED, REVISION
- Roles: ADMIN, PREPARATEUR, IMPRIMEUR, IMPRIMEUR_ROLAND, IMPRIMEUR_XEROX, LIVREUR
- Features: Role-based transitions, guards (machine/user), available actions, notifications mapping.

## Quick start

1) Run the demo (already runnable)
- We executed the demo locally and validated transitions and notifications.

2) Integrate in your backend
Use the pure functions exported by the module (no DB/HTTP dependency):
- canTransition(user, job, newStatus) → { allowed, reason? }
- getAvailableActions(user, job) → [{ status, label, icon, type }]
- canDeleteJob(user, job) → { allowed, reason? }
- canViewJob(user, job) → boolean
- getNotifications(job, oldStatus, newStatus, changedBy) → Notification[]

Data contracts:
- user: { id: string, role: Role }
- job: { id, jobNumber, status, machineType: 'roland'|'xerox', createdById }
- Role ∈ Roles, Status ∈ Status

## Event mapping (example)
Notifications produced by getNotifications can be mapped to your WebSocket/bus events:
- jobReady → emit 'job:ready_for_print' to imprimeurs/admins (filter by machineType if needed)
- jobCompleted → emit 'job:ready_for_delivery' to livreurs and 'job:moved_to_delivery' to all
- jobNeedsRevision → emit 'job:needs_revision' to job creator (and admins)
- jobDelivered → emit 'job:delivered' to all or to creator/admins

This mirrors backend/services/websocket.js logic and keeps the adapter generic (types are consistent, event names are customizable on your side).

## Customize
Adjust ROLE_TRANSITIONS, labels, icons and types in src/config.js to fit a different workflow or roles set. The engine functions will reflect your changes automatically.

## Notes
- No side effects; ideal for unit tests and integration in any Node/Express/Koa/Nest backend.
- The same module can power a different platform by reusing your roles/statuses mapping and keeping your own persistence and transport layers.
