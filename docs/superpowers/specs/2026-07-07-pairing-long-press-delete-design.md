# Pairing Long-Press Delete Design

## Goal

Add a long-press delete action to each concrete companion card on the steward "我的陪伴" screen. The action deletes that specific pairing and companion avatar/persona from the account, using the existing backend pairing deletion API.

## Current Context

- The steward pairing list is rendered in `apps/xiaonuan-app/app/(steward)/index.tsx`.
- Each list item is rendered by `apps/xiaonuan-app/src/components/steward/PairingCard.tsx`.
- The mobile pairing service currently supports list, create, bind, refresh invite code, and detail fetch operations.
- The gateway already exposes `DELETE /api/pairings/:pairingId`.
- Backend deletion is restricted to authenticated steward users who are primary members of the pairing.

## Recommended Approach

Use the existing `PairingCard` as the interaction surface. A normal tap keeps opening the pairing detail page. A long press on a specific card opens a destructive confirmation prompt for that specific companion.

Flow:

1. User long-presses one companion card.
2. The app shows a native confirmation dialog with that companion's name.
3. User chooses "删除陪伴".
4. The app calls `DELETE /api/pairings/:pairingId` through a new `deletePairing` service helper.
5. On success, the deleted pairing is removed from the local list.
6. On failure, the app shows the backend or network error message and keeps the card visible.

This keeps the change small, native-feeling, and consistent with the existing Expo/React Native code.

## UI Behavior

- Short press: unchanged, navigates to `/(steward)/${pairingId}`.
- Long press: opens a native alert menu for the pressed card only.
- Confirmation text includes the companion name, for example: `删除 张阿姨 的陪伴？`.
- The destructive action label is `删除陪伴`.
- The cancel action label is `取消`.
- While deletion is in progress, repeated delete attempts for the same card are ignored.
- If the deleted card was the last companion, the existing empty state appears.

## API And Data Flow

Add `deletePairing(token, pairingId)` in `apps/xiaonuan-app/src/services/pairing.ts`.

The list screen owns deletion state and orchestration:

- `PairingCard` receives an optional `onLongPress` callback.
- `PairingListScreen` passes a callback with the selected `Pairing`.
- The callback opens the native confirmation dialog.
- On confirm, it calls `deletePairing`.
- On success, `setPairings((current) => current.filter((p) => p.id !== pairing.id))`.

No backend schema or route changes are needed.

## Error Handling

- Missing token: show a generic login/session error and do not call the API.
- 403 from backend: show the backend message, such as `仅主要家庭成员可删除配对`.
- Network or server failure: show a non-destructive error alert and leave the pairing in the list.
- Unknown companion name: use `未知` in the confirmation text, matching the existing card fallback.

## Testing

Add focused mobile tests:

- Service test for `deletePairing` to verify it calls `/api/pairings/:pairingId` with method `DELETE` and token.
- Card wiring test for `PairingCard` to verify `onLongPress` is accepted and called.

Existing backend tests already cover the delete endpoint's primary-steward permission and success behavior.

## Out Of Scope

- Adding a custom bottom sheet or new UI dependency.
- Adding undo or soft delete.
- Changing backend deletion semantics.
- Allowing non-primary stewards to delete pairings.
