# MY DAY Security Specification (Phase 0)

## 1. Data Invariants
1. Every document under `/users/{userId}` and `/users/{userId}/planners/{plannerId}` belongs exclusively to the authenticated Firebase user whose `request.auth.uid == userId`.
2. Unauthenticated callers (`request.auth == null`) have zero read or write access to any path.
3. Unverified accounts (`request.auth.token.email_verified != true`) cannot perform Firestore writes.
4. No user can list `/users` (prevents PII/email enumeration).
5. `ownerId` (on planners), `uid` (on user metadata), `plannerId`, and `createdAt` are immutable after creation.
6. All `createdAt` and `updatedAt` timestamps must match `request.time` (server timestamps).
7. All document IDs (`userId`, `plannerId`) match `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
8. Every update must pass `isValidUserWorkspaceMeta` or `isValidUserPlanner` and explicitly allowlist changed keys with `affectedKeys().hasOnly(...)`.
9. Every list operation on `/users/{userId}/planners` enforces `resource.data.ownerId == request.auth.uid` without `get()`/`exists()` inside `allow list`.
10. All arrays inside `PlannerState` are strictly bounded (`schedules <= 1000`, `todos <= 1000`, `customWidgets <= 30`, etc.).

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read**: `get(/users/alice)` with `auth = null`.
2. **Cross-UID read**: User `bob` reads `/users/alice` or `/users/alice/planners/p1`.
3. **Cross-UID list**: User `bob` lists `/users/alice/planners` with `where('ownerId', '==', 'alice')`.
4. **Root users list scraping**: User `bob` lists `/users`.
5. **Identity spoofing on create**: User `bob` creates `/users/bob/planners/p1` with `ownerId: 'alice'`.
6. **Unverified email write**: User `bob` (`email_verified: false`) writes `/users/bob`.
7. **Shadow / Ghost field injection**: User `bob` writes `/users/bob` with extra key `isAdmin: true` or `role: 'admin'`.
8. **Immutable field tampering on update**: User `bob` updates `/users/bob/planners/p1` changing `ownerId` or `createdAt`.
9. **Client-forged timestamp**: User `bob` creates `/users/bob` with `createdAt: Timestamp(2020-01-01)`.
10. **ID Poisoning**: User `bob` writes `/users/bob/planners/bad..id$with/chars` or >128-char ID.
11. **Value Poisoning**: User `bob` updates `/users/bob/planners/p1` with `name: ""` (empty) or 500-char string, or `data.schedules: "not-a-list"`.
12. **Orphan planner write**: User `bob` creates `/users/bob/planners/p1` when `/users/bob` does not exist and is not in the same batch.
