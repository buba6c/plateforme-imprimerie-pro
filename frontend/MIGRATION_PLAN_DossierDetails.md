# Migration plan: DossierDetails (.disabled) → DossierDetailsFixed.rebuilt.js

Date: 2025-10-17
Owner: Frontend

## Scope
- Source to analyze: `src/components/dossiers/DossierDetailsFixed.js.disabled` (1839 lines, corrupted but feature-rich)
- Target: `src/components/dossiers/DossierDetailsFixed.rebuilt.js` (clean, compiling)
- Goal: reach functional parity safely, in small verified steps, no regressions

## Summary of current parity
- Implemented in rebuilt (✅):
  - Modal shell, header (id, status badge, created_at)
  - Tabs: General / Technical / Files / History
  - Technical table for both Roland and non-Roland (no <div> inside <tbody>)
  - File list with thumbnail, preview, download, delete (with confirmation)
  - Upload with permissions by role (admin, préparateur owner, imprimeur by machine+status; livreur denied)
  - Workflow actions via `getAvailableActions` + handler mapping (imprimeur `termine` → `pret_livraison`)
  - Review modal (comment for "a_revoir")
  - Admin "force status" modal
  - Robust id resolution on open; resilient date formatting; build passes

- Missing vs .disabled (to migrate) (🟡 planned / 🔵 optional):
  1) 🟡 Notification service integration (success/error toasts)
  2) 🟡 Reprint with comment modal + UI trigger
  3) 🟡 Admin "unlock" flag/action (showUnlock)
  4) 🟡 History visual timeline (improved UI over simple list)
  5) 🔵 Advanced status badges (gradients, icons, pulse)
  6) 🔵 Dark mode class variants (we’re minimal now)
  7) 🔵 Delivery confirmation modal (date, payment mode CFA) — consider scoping to Livreur flows
  8) 🔵 File validations (filterValidFiles) pre-upload
  9) 🔵 More granular PropTypes and defaults

## Detailed mapping
- Status workflow
  - Source: `.disabled` used `getAvailableActions(...)`, `handleStatusClick`, admin unlock, reprint, review comment
  - Target: we already route actions via `handleActionClick`; add:
    - Admin unlock (boolean `showUnlock`) and its action button
    - Reprint button that opens comment modal (then `dossiersService.reprintDossier`)

- Permissions
  - Already ported: préparateur owner + allowed statuses; imprimeur by machine; admin full; livreur denied

- Files
  - Already: preview, download, delete (confirm), upload (modal inline area)
  - To add: `filterValidFiles` before upload; max size/errors surfaced via notifications

- UI/UX
  - History: simple list → timeline (icons, badges, nicer timestamps)
  - Status badge: plain → themed variants
  - Dark mode: optional pass adding `dark:` classes progressively

- Livreur-specific delivery modal
  - Present in `.disabled` (payment method Wave/OM/CFA amount)
  - Recommendation: keep this in Livreur dashboards; if needed inside DossierDetails, gate by `user.role === 'livreur'` and surface a context action

## Step-by-step migration (safe increments)
1) Notifications (5–10 min)
   - Add lightweight helpers:
     - `notifySuccess(msg)`, `notifyError(msg)` using existing Toast/notification (e.g., `components/ui/Toast` or `notificationService` if present)
   - Wire into file upload/delete, status changes, reprint

2) Reprint with comment (10–15 min)
   - State: `showCommentModal`, `commentModalValue`
   - Header button (visible to préparateur/imprimeur/admin) → opens modal
   - On confirm: call `handleReprintDossier(comment)` → reload

3) Admin unlock (10 min)
   - Compute `showUnlock = user.role === 'admin' && dossier?.valide_preparateur`
   - Button near actions → calls `dossiersService.unlockDossier(effectiveId)` (or placeholder) and reload

4) History timeline (20–30 min)
   - Replace list with timeline component (icons by status, colored left border, relative dates)

5) Optional polish (time-box each)
   - Badges (gradients/icons) (10–15 min)
   - Dark mode classes (15–20 min)
   - File validations (10 min)
   - Delivery modal (Livreur only) (25–40 min) — if required here

## Acceptance criteria
- Build passes, no new ESLint errors in this file
- All existing features still work (tabs, file ops, actions)
- New features verifiable manually: review modal, force status, delete confirm, reprint comment, (optional) unlock/timeline

## Rollback plan
- Keep `DossierDetailsFixed.rebuilt.js` under git; edit incrementally
- Guard any new API calls with try/catch + notifications; do not block UI

## Implementation notes (code hooks)
- Where to add buttons in header:
  - After mapped actions; show: Reprint (préparateur/imprimeur/admin), Unlock (admin)
- Services used: `dossiersService.changeStatus`, `dossiersService.reprintDossier`, (optional) `dossiersService.unlockDossier`
- Keep modal z-index ≥ 60; re-use existing modal styles from rebuilt

## Next actions
- Implement steps 1–3 now (notifications, reprint modal, admin unlock)
- Then decide on timeline vs delivery modal priority