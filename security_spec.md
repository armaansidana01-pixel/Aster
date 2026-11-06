# Firestore Security Specification — Aster SAT Studio

## 1. Data Invariants
1. **Strict Ownership**: A `/workspaces/{userId}` document can only be read, created, updated, or deleted by the authenticated user whose `request.auth.uid == userId` and `data.ownerId == request.auth.uid`.
2. **Verified Identity for Writes**: All write operations require `request.auth.token.email_verified == true`.
3. **Strict Schema & Volumetric Bounds**: `UserWorkspace` documents must contain only the exact 8 allowed keys (`ownerId`, `displayName`, `targetScore`, `studyGoal`, `theme`, `payloadJson`, `createdAt`, `updatedAt`) with strict string `.size()` bounds and numeric range checks (`400 <= targetScore <= 1600`).
4. **Temporal & Identity Immutability**: `ownerId` and `createdAt` are immutable on update; `createdAt` and `updatedAt` must equal `request.time`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/workspaces/user_1`. -> `PERMISSION_DENIED`
2. **Unverified Email Spoof**: `auth.uid = 'user_1', email_verified = false`, creating `/workspaces/user_1`. -> `PERMISSION_DENIED`
3. **Cross-User Read (PII / Workspace Leak)**: `auth.uid = 'user_2'` reading `/workspaces/user_1`. -> `PERMISSION_DENIED`
4. **OwnerId Spoofing on Create**: `auth.uid = 'user_1'` creating `/workspaces/user_1` with `ownerId: 'user_2'`. -> `PERMISSION_DENIED`
5. **Shadow / Ghost Field Injection**: Creating `/workspaces/user_1` with extra key `isAdmin: true`. -> `PERMISSION_DENIED`
6. **Path ID Poisoning**: Creating `/workspaces/invalid$id!` with non-alphanumeric characters. -> `PERMISSION_DENIED`
7. **Denial-of-Wallet Oversized String**: Setting `displayName` to a 500-char string (limit 80). -> `PERMISSION_DENIED`
8. **Out-of-Bounds Target Score**: Setting `targetScore: 2500` (limit 400..1600). -> `PERMISSION_DENIED`
9. **Invalid Enum Value**: Setting `theme: 'neon-cyber'` (allowed: `'dark'`, `'light'`). -> `PERMISSION_DENIED`
10. **Immortal Field Mutation on Update**: Changing `createdAt` or `ownerId` during `update`. -> `PERMISSION_DENIED`
11. **Forged Client Timestamp**: Setting `updatedAt` to a past/future timestamp instead of `request.time`. -> `PERMISSION_DENIED`
12. **Blanket Collection List**: Attempting an unrestricted `list` query on `/workspaces`. -> `PERMISSION_DENIED`
