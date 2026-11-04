# Permissions & User Management — Independent Security Code Review & Adversarial Verification Report

**Application:** NestJS Multi-Vendor Marketplace Platform  
**Target Module:** Permissions & User Management Modules  
**Auditor:** Independent Senior Application Security Engineer & Adversarial QA Specialist  
**Audit Reference:** `docs/audits/permissions-user-management-api-audit.md` & `docs/audits/permissions-user-management-remediation.md`  
**Execution Date:** November 1, 2026  
**Review Type:** Independent Source Code Review, Static Analysis, Unit Test Quality Audit & Live Runtime Adversarial Probing  
**Final Verdict:** **REQUIRES FURTHER REMEDIATION** (High-Severity Privilege Escalation & Authorization Gaps Discovered)

---

## 1. Executive Summary & Review Verdict

An independent adversarial code review and runtime penetration verification was conducted against the recent security remediations in the Permissions and User Management modules.

While the previous remediation successfully resolved several critical vulnerabilities—including **password hash exposure in profile picture responses (VULN-USER-01)**, **session revocation on password change (VULN-AUTH-01)**, **DTO validation bypass (VULN-VAL-01)**, and **unhandled BSONError crashes (VULN-VAL-02)**—rigorous adversarial probing revealed **critical remaining vulnerabilities and implementation discrepancies** in Super Admin authorization and privilege escalation barriers:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   INDEPENDENT REVIEW VERDICT DASHBOARD                                │
├───────────────┬────────────────────────────────────────────────────────┬──────────────────┬───────────┤
│ Finding ID    │ Vulnerability Description                              │ Review Status    │ Severity  │
├───────────────┼────────────────────────────────────────────────────────┼──────────────────┼───────────┤
│ VULN-PERM-01  │ Privilege Escalation & Super Admin Authorization       │ PARTIALLY FIXED  │ HIGH      │
│ NEW-SEC-01    │ Forged JWT role: 'super_admin' Bypasses Guards         │ REGRESSION FOUND │ CRITICAL  │
│ NEW-SEC-02    │ Blocked/Disabled Super Admin Allowed Full Access       │ REGRESSION FOUND │ HIGH      │
│ NEW-SEC-03    │ Staff with user.manage Can Demote Super Admin Account  │ REGRESSION FOUND │ HIGH      │
│ VULN-USER-01  │ Bcrypt Password Hash Exposure in Profile Pic           │ VERIFIED FIXED   │ Resolved  │
│ VULN-AUTH-01  │ Multi-Session & Token Revocation on Password Change    │ VERIFIED FIXED   │ Resolved  │
│ VULN-VAL-01   │ Disabled DTO Validation on Permission Creation         │ VERIFIED FIXED   │ Resolved  │
│ VULN-VAL-02   │ Unhandled BSONError (500) on Malformed ObjectIds       │ VERIFIED FIXED   │ Resolved  │
│ VULN-ARCH-01  │ Cache Layer DIP Mismatch & Dual-Key Split-Brain        │ PARTIALLY FIXED  │ MEDIUM    │
│ VULN-ARCH-02  │ Pending Vendor Lockout on Profile Endpoints            │ VERIFIED FIXED   │ Resolved  │
│ VULN-ROUTE-01 │ Duplicate Route Aliasing (/users and /user)            │ NOT APPLICABLE   │ Informational│
│ VULN-DATA-01  │ Inconsistent Database Role Casing                      │ PARTIALLY FIXED  │ Low       │
└───────────────┴────────────────────────────────────────────────────────┴──────────────────┴───────────┘
```

**Final Assessment Verdict:** **`REQUIRES FURTHER REMEDIATION`**  
The module cannot be signed off as production-safe until the Super Admin authorization bypass in `PermissionsGuard` (NEW-SEC-01), account status verification (NEW-SEC-02), and the Super Admin account demotion vulnerability in `PermissionsService` (NEW-SEC-03) are resolved.

---

## 2. Source Files Inspected

The following source files, schemas, guards, services, and tests were inspected in detail:

1. [`src/common/guards/permissions.guard.ts`](file:///E:/nest/first-app/src/common/guards/permissions.guard.ts) (Super Admin bypass, RBAC resolution, database check)
2. [`src/common/guards/authentication.guard.ts`](file:///E:/nest/first-app/src/common/guards/authentication.guard.ts) (Token version validation, cache fallback)
3. [`src/common/guards/approved-entity.guard.ts`](file:///E:/nest/first-app/src/common/guards/approved-entity.guard.ts) (Entity status gating, `@AllowPendingEntity`)
4. [`src/modules/permissions/permissions.service.ts`](file:///E:/nest/first-app/src/modules/permissions/permissions.service.ts) (Delegation validation, Super Admin verification, CRUD)
5. [`src/modules/permissions/permissions.controller.ts`](file:///E:/nest/first-app/src/modules/permissions/permissions.controller.ts) (Guards, caller context propagation)
6. [`src/modules/permissions/dto/create-permission.dto.ts`](file:///E:/nest/first-app/src/modules/permissions/dto/create-permission.dto.ts) (Class-validator decorators)
7. [`src/modules/permissions/dto/update-permission.dto.ts`](file:///E:/nest/first-app/src/modules/permissions/dto/update-permission.dto.ts) (PartialType extension)
8. [`src/common/utils/safe-user.serializer.ts`](file:///E:/nest/first-app/src/common/utils/safe-user.serializer.ts) (Sensitive property stripping)
9. [`src/modules/user/user.service.ts`](file:///E:/nest/first-app/src/modules/user/user.service.ts) (Password change, avatar update, profile methods)
10. [`src/modules/user/user.controller.ts`](file:///E:/nest/first-app/src/modules/user/user.controller.ts) (`@AllowPendingEntity` binding, route paths)
11. [`src/modules/auth/auth.service.ts`](file:///E:/nest/first-app/src/modules/auth/auth.service.ts) (`generateTokens`, `refreshToken`, session locking)
12. [`src/models/user/user.schema.ts`](file:///E:/nest/first-app/src/models/user/user.schema.ts) (User schema attributes)
13. [`src/models/session/session.schema.ts`](file:///E:/nest/first-app/src/models/session/session.schema.ts) (Session schema attributes)
14. [`src/shared/cache/providers/redis-cache.service.ts`](file:///E:/nest/first-app/src/shared/cache/providers/redis-cache.service.ts) (Cache timeout wrapper)
15. [`src/modules/permissions/tests/permissions-user-management-remediation.spec.ts`](file:///E:/nest/first-app/src/modules/permissions/tests/permissions-user-management-remediation.spec.ts) (Regression unit test suite)

---

## 3. Super Admin Authorization Review (Detailed Findings)

### 1. What exact server-side database condition establishes Super Admin identity?
In [`PermissionsGuard`](file:///E:/nest/first-app/src/common/guards/permissions.guard.ts#L276-L283), Super Admin identity is established if:
- `dbUserRole === 'super_admin'` OR `dbUserRole === 'superadmin'`
- OR (`dbPerms.includes('platform.super_admin')` AND (`dbUserRole === 'admin'`))
Where `dbPerms` is the union of `dbUser.permissions` (from `User` collection) and `permDoc.permissions` (from `Permission` collection).

In [`PermissionsService.isSuperAdmin`](file:///E:/nest/first-app/src/modules/permissions/permissions.service.ts#L117-L131), the condition requires:
- `actor.status === 'ACTIVE'` AND `actor.isEmailVerified === true`
- AND (`roleLower === 'super_admin'` OR `roleLower === 'superadmin'` OR (`permDoc.permissions.includes('platform.super_admin')` AND `roleLower === 'admin'`)).

### 2. Can an ordinary employee modify that condition?
- Ordinary employees cannot alter user roles directly, because `UserController` exposes no role-modification endpoint.
- **HOWEVER, an ordinary employee with `user.manage` CAN modify Super Admin permissions in `PermissionsService`** due to a discrepancy between `PermissionsService` and `PermissionsGuard` (see NEW-SEC-03).

### 3. Can a user with `user.manage` grant themselves Super Admin privileges indirectly?
- **Protected Against Direct Self-Grant**: `validatePermissionDelegation` in `PermissionsService` checks `actorId === targetUserId` and `requestedPermissions.includes('platform.super_admin')`.
- **Protected Against Scope Exceedance**: Non-super-admins cannot grant permissions outside their own assigned permissions.

### 4. Can an employee modify an existing Super Admin account?
- **VULNERABILITY CONFIRMED (NEW-SEC-03)**: In [`PermissionsService.isSuperAdmin`](file:///E:/nest/first-app/src/modules/permissions/permissions.service.ts#L127-L131), the service checks if `targetUserId` is Super Admin by querying **only** `permissionRepo.getOne({ userId })`. It does **not** check `user.permissions` on the `User` document.
- In MongoDB, the platform Super Admin (`ym9798390@gmail.com`) has `platform.super_admin` in `user.permissions`. Because `permissionRepo.getOne` returned null or lacked this grant, `isSuperAdmin` evaluated the Super Admin as `false`!
- **Runtime Proof**: During live testing, an employee with `user.manage` called `POST /permissions` targeting the Super Admin with `permissions: ['product.read']`. The request succeeded with **HTTP 201 Created** (ADV-SA-03 failed), successfully demoting the Super Admin's effective custom permissions!

### 5. Does the Super Admin bypass apply only to intended endpoints?
- **VULNERABILITY CONFIRMED (NEW-SEC-01)**: In [`PermissionsGuard`](file:///E:/nest/first-app/src/common/guards/permissions.guard.ts#L167-L175):
  ```typescript
  const roleUpper = (user.role || '').toUpperCase().trim();
  const roleLower = (user.role || '').toLowerCase().trim();

  // 1. Super Admin bypass (SUPER_ADMIN, super_admin, superadmin)
  const isSuperAdmin =
    roleUpper === 'SUPER_ADMIN' ||
    roleLower === 'super_admin' ||
    roleLower === 'superadmin' ||
    roleLower === RolesEnum.SUPER_ADMIN.toLowerCase();

  if (isSuperAdmin) {
    return true; // RETURNS IMMEDIATELY FROM JWT CLAIM!
  }
  ```
  `user.role` is read from `req.user` (the decoded JWT payload). It returns `true` immediately without ANY database lookup!
  Any token signed with `JWT_SECRET` containing `{ role: 'super_admin' }` completely bypasses all permission checks across the entire platform, even if the database record is a regular customer or blocked user.

### 6. Does Super Admin authorization remain valid if the JWT contains stale or forged permissions?
- If the JWT contains forged permissions (e.g. `permissions: ['platform.super_admin']`), `PermissionsGuard` lines 292-294 strips it if server-side DB verification fails.
- **HOWEVER**, if the JWT contains `role: 'super_admin'` (the role claim), lines 167-175 bypass the guard before any DB check occurs.

### 7. If a Super Admin is demoted or disabled, are existing access tokens rejected immediately?
- **VULNERABILITY CONFIRMED (NEW-SEC-02)**: Neither `AuthenticationGuard` nor `PermissionsGuard` checks whether the user's account is `status: 'ACTIVE'`.
- `AuthenticationGuard` only validates `tokenVersion`. If an administrator's account is set to `status: 'BLOCKED'`, but `tokenVersion` is not rotated, their existing access token remains 100% functional until expiration.
- **Runtime Proof**: In live test ADV-SA-02, a Super Admin account with `status: 'BLOCKED'` in MongoDB called `GET /permissions` and received **HTTP 200 OK**.

### 8. Are company and seller tenant boundaries still enforced?
- **Verified Enforced**: In [`PermissionsService.validatePermissionDelegation`](file:///E:/nest/first-app/src/modules/permissions/permissions.service.ts#L198-L207):
  ```typescript
  if (actorUser?.sellingEntityId) {
    if (
      !targetUser.sellingEntityId ||
      targetUser.sellingEntityId.toString() !== actorUser.sellingEntityId.toString()
    ) {
      throw new ForbiddenException(
        'Cannot manage permissions for users outside your organization or store',
      );
    }
  }
  ```
- **Runtime Proof**: Live test ADV-TI-01 confirmed Company Admin A attempting to assign permissions to a user in Company B was rejected with **HTTP 403 Forbidden**.

### 9. Is there a privilege escalation path through permission update or delete operations?
- In `update` and `remove` methods of `PermissionsService`, `validatePermissionDelegation` is invoked before modifying or deleting records.
- However, because `validatePermissionDelegation` relies on `this.isSuperAdmin(targetUserId)` which suffers from the `user.permissions` omission flaw (NEW-SEC-03), an employee can delete or overwrite a Super Admin's permission record.

### 10. Can a user modify the permissions of a user outside their tenant?
- No. Tenant boundaries are strictly validated in `validatePermissionDelegation`. Attempts to cross entity boundaries fail with HTTP 403.

---

## 4. Token Version and Session Revocation Review

### 1. Which source is authoritative: MongoDB or Redis?
- **Architectural Ambiguity**: In [`AuthenticationGuard`](file:///E:/nest/first-app/src/common/guards/authentication.guard.ts#L84-L121), the guard queries Redis first. If Redis returns a value, it uses that value as `expectedVersion` and **never queries MongoDB**.
- MongoDB is only queried when Redis returns `null` (cache miss or cold start).
- Therefore, **Redis acts as the de-facto primary authority**, and MongoDB is only a secondary fallback.

### 2. What happens when the cache is cold?
- When Redis has no key for `auth:token_version:${userId}`, `AuthenticationGuard` lines 105-116 correctly falls back to MongoDB:
  ```typescript
  const dbUser = await userModel.findById(userId).select('tokenVersion').lean();
  if (dbUser && (dbUser as any).tokenVersion !== undefined) {
    expectedVersion = Number((dbUser as any).tokenVersion);
    if (this.cacheManager) {
      await this.cacheManager.set(authKey, expectedVersion, 86400 * 30 * 1000);
    }
  }
  ```
- The MongoDB value is loaded and backfilled into Redis. This fallback was verified functional in live testing.

### 3. What happens when Redis is unavailable?
- `RedisCacheService` wraps calls in `withTimeout(..., 1500ms)`. If Redis is down, it catches the error and returns `null`.
- `AuthenticationGuard` catches the timeout and falls back to MongoDB.

### 4. Does a Redis timeout fail closed or accidentally allow the request?
- **FAIL-OPEN RISK IDENTIFIED**: In [`AuthenticationGuard`](file:///E:/nest/first-app/src/common/guards/authentication.guard.ts#L122-L136):
  ```typescript
  if (expectedVersion !== null) {
    const tokenVersion = Number(decoded.tokenVersion ?? 1);
    if (tokenVersion !== expectedVersion) {
      throw new UnauthorizedException('الجلسة ملغاة، يرجى تسجيل الدخول مجدداً');
    }
  }
  req.user = decoded;
  return true;
  ```
  If Redis times out AND MongoDB is temporarily unreachable or throws an error:
  `expectedVersion` remains `null`.
  The guard skips the version check and executes: `req.user = decoded; return true;`.
  This is a **fail-open** condition allowing revoked tokens to pass during database/cache outages.

### 5. Can a stale Redis value override a newer MongoDB tokenVersion?
- **YES**: Because `AuthenticationGuard` line 105 only queries MongoDB `if (expectedVersion === null)`, any existing key in Redis (valid for 30 days) overrides whatever is stored in MongoDB. If a database administrator increments `tokenVersion` directly in MongoDB without purging Redis, the change has zero effect until the Redis key expires.

### 6. Does password change revoke every session belonging to the user and only that user?
- **VERIFIED FIXED**: In [`UserService.changePassword`](file:///E:/nest/first-app/src/modules/user/user.service.ts#L181-L190):
  ```typescript
  await this.sessionRepo.updateMany(
    { userId: objectId, isRevoked: false },
    {
      $set: {
        isRevoked: true,
        activeTokenHash: '',
        revocationReason: 'PASSWORD_CHANGED',
      },
    },
  );
  ```
  This revokes all active sessions for that specific `userId` and sets `activeTokenHash: ''`.

### 7. Is the password update coordinated with session revocation and tokenVersion rotation?
- **Atomicity Assessment**: The password hash update and `tokenVersion` increment are atomic within the MongoDB `User` document (`updateOne({ _id }, { $inc: { tokenVersion: 1 }, $set: { password } })`).
- However, the subsequent updates to Redis and `sessionRepo` are executed sequentially outside of a database transaction. If the server crashes between updating `User` and updating `SessionRepo`, MongoDB `tokenVersion` is updated, but sessions remain unrevoked. Fortunately, because `AuthenticationGuard` validates `tokenVersion`, old access tokens are still rejected.

### 8. Can a concurrent refresh request create a valid session after password change?
- **Protected Against Race Conditions**: In [`AuthService.refreshToken`](file:///E:/nest/first-app/src/modules/auth/auth.service.ts#L988-L1029), session rotation uses a conditional update lock:
  ```typescript
  const filterLock = {
    _id: existingSession._id,
    isRevoked: false,
    activeTokenHash: incomingTokenHash,
  };
  const updatedSession = await sessionModel.findOneAndUpdate(filterLock, updateOps, { new: true });
  if (!updatedSession) {
    throw new UnauthorizedException('Token rotation conflict');
  }
  ```
  If `changePassword` marked `isRevoked: true` concurrently, `filterLock` fails to match and returns null, throwing `401 Unauthorized ('Token rotation conflict')`.

### 9. Does logout-all use the same revocation mechanism?
- Yes. `logoutAll` rotates `tokenVersion` and revokes `Session` documents matching `{ userId }`.

### 10. Does refresh-token rotation remain single-use after these changes?
- **VERIFIED FIXED**: Consuming a refresh token moves its hash into `consumedTokenHashes`. Re-submitting the same token triggers reuse detection, immediately revoking the entire session family.

---

## 5. Dual-Key Analysis (`auth:token_version` vs `token_version`)

The codebase uses two distinct Redis keys for token versioning:
1. `auth:token_version:${userId}`
2. `token_version:${userId}`

### Behavioral Divergence Discovered:
- In [`AuthService.generateTokens`](file:///E:/nest/first-app/src/modules/auth/auth.service.ts#L92), the service reads **only** `auth:token_version:${userId}`. It completely ignores `token_version:${userId}`!
- In [`AuthService.getUserTokenVersion`](file:///E:/nest/first-app/src/modules/auth/auth.service.ts#L67), it reads **only** `auth:token_version:${userId}`.
- In [`AuthenticationGuard`](file:///E:/nest/first-app/src/common/guards/authentication.guard.ts#L84-L96), it reads `token_version:${userId}` **first**, and only falls back to `auth:token_version:${userId}` if the former is null!
- In [`PermissionsService.invalidateTokenVersion`](file:///E:/nest/first-app/src/modules/permissions/permissions.service.ts#L79-L91):
  ```typescript
  await this.cacheService.set(`auth:token_version:${idStr}`, nextVal, 86400 * 30);
  await this.cacheService.set(`token_version:${idStr}`, nextVal, 86400 * 30);

  if (this.cacheManager) {
    const store = (this.cacheManager as any)?.store;
    if (store?.client?.incr) {
      await store.client.incr(`auth:token_version:${idStr}`);
      await store.client.incr(`token_version:${idStr}`);
    }
  }
  ```
  **Double-Increment Bug**: `cacheService.set` sets both keys to `nextVal` (e.g. 2). Then `store.client.incr` increments both keys again to 3! Meanwhile, MongoDB `User.tokenVersion` was incremented by only 1 (from 1 to 2). This causes an immediate divergence between Redis (version 3) and MongoDB (version 2).

---

## 6. Safe User Serializer Review

The centralized serializer [`serializeSafeUser`](file:///E:/nest/first-app/src/common/utils/safe-user.serializer.ts) was inspected across all consumer endpoints.

### Verification Matrix:
| Property | Expected Status | Actual Status | Verification Method |
|---|---|---|---|
| `password` | STRIPPED | **Omitted** | Verified live on `PATCH /users/profile-pic` & `GET /users/profile` |
| `password` (hash) | STRIPPED | **Omitted** | Verified live (ADV-SEC-01, ADV-SEC-03) |
| `emailVerificationOtpHash` | STRIPPED | **Omitted** | Verified live (ADV-SEC-01) |
| `emailVerificationOtpExpiresAt` | STRIPPED | **Omitted** | Verified live |
| `resetTokenHash` | STRIPPED | **Omitted** | Verified live |
| `resetOtpHash` | STRIPPED | **Omitted** | Verified live |
| `refreshTokenHash` | STRIPPED | **Omitted** | Verified live |
| `consumedTokenHashes` | STRIPPED | **Omitted** | Verified live |
| `tokenVersion` | OMITTED? | **EXPOSED** | Observation: `tokenVersion` is retained on user object |

### Output Structure Observation:
- `getProfile` returns `{ success: true, user: safeUser, orders: [] }`.
- `updateProfile` returns `{ success: true, message: '...', user: safeUser }`.
- `updateProfilePic` returns `safeUser` directly (not wrapped in `{ user: safeUser }`). While secure, this creates an inconsistency in API envelope formatting.

---

## 7. Pending Entity Guard Review

Inspection of [`ApprovedEntityGuard`](file:///E:/nest/first-app/src/common/guards/approved-entity.guard.ts) and all endpoints decorated with `@AllowPendingEntity()` confirmed:

### Permitted Endpoints for Pending Merchants:
1. `GET /users/profile` & `GET /user/profile`: Read own personal profile.
2. `PATCH /users/profile` & `PATCH /user/profile`: Update contact info/name.
3. `PATCH /users/change-password` & `PATCH /user/change-password`: Update account password.
4. `PATCH /users/profile-pic` & `PATCH /user/profile-pic`: Update avatar URL.
5. `GET /merchant/profile`: Read merchant entity onboarding details.
6. `GET /merchant/entity/status`: Check store verification status.
7. `POST /merchant/entity/documents`: Upload verification documents.

### Operational Endpoints Verified Locked Down:
- `POST /products`: **403 Forbidden** (ADV-PE-02 PASS).
- `POST /api/payouts/request`: **403 Forbidden** (ADV-PE-03 PASS).
- `orders`, `inventory`, `seller-payout`: Strictly guarded against unapproved entities.

### Lifecycle Status Enforcement:
- If status is `REJECTED`, `SUSPENDED`, or `DEACTIVATED`, lines 196-206 throw `ForbiddenException` regardless of `@AllowPendingEntity()`. Pending exceptions apply **only** to `PENDING_APPROVAL`.

---

## 8. DTO & ObjectId Validation Review

### Findings:
1. `POST /permissions` rejects empty payloads `{}` with **400 Bad Request** (ADV-VAL-01 PASS).
2. `POST /permissions` rejects arbitrary non-canonical permission strings with **400 Bad Request** (ADV-VAL-02 PASS).
3. Malformed MongoDB ObjectIds across all 4 parameterized endpoints (`GET /permissions/:id`, `GET /permissions/user/:userId`, `PATCH /permissions/:id`, `DELETE /permissions/:id`) return **400 Bad Request**, completely eliminating unhandled `BSONError` 500 crashes (ADV-VAL-03..06 PASS).
4. Non-existent valid ObjectIds return **404 Not Found** (ADV-VAL-07 PASS).
5. **Minor Observation**: `PATCH /permissions/:id` accepts `{}` because `UpdatePermissionDto` uses `PartialType(CreatePermissionDto)`. When an empty body is sent, the service executes a no-op update and returns the existing document without error.

---

## 9. Test Quality Audit

| Test Suite | Execution Target | Mocking Level | HTTP Routing Tested? | Mutation Assertion Quality | Identified Limitations |
|---|---|---|---|---|---|
| `permissions-user-management-remediation.spec.ts` (21 tests) | Unit / Service Layer | **100% Mocked** (In-memory Maps) | **No** (Direct service calls) | **Good** for service logic; fails if logic changes | Does not test NestJS Guards (`PermissionsGuard`, `AuthenticationGuard`), pipes, or real DB queries. Missed NEW-SEC-01 and NEW-SEC-03. |
| `permissions.service.spec.ts` (11 tests) | Unit / Service Layer | **100% Mocked** | **No** | **Moderate** | Legacy mock suite with coarse assertions. |
| `user.controller.spec.ts` (7 tests) | Controller Layer | **100% Mocked** | **No** | **Low** | Asserts controller delegates to service. Does not verify guard behavior. |
| `verify-remediation-runtime.cjs` (18 tests) | Real HTTP Server | Real Server / Real DB / Real Redis | **Yes** | **High** | Did not test adversarial JWT forgery (forged `role: 'super_admin'`) or blocked admin status. |
| `independent-adversarial-verification.cjs` (26 tests) | Real HTTP Server | **Real Server / Real DB / Live Probing** | **Yes** | **Adversarial** | **Uncovered 3 critical runtime failures (ADV-SA-01, ADV-SA-02, ADV-SA-03).** |

---

## 10. Adversarial Test Results Matrix

Summary of the 26 live adversarial tests executed on `http://localhost:3000`:

```
========================================================================
🏁 Independent Adversarial Tests: 26 Executed | 23 PASS | 3 FAIL
========================================================================
```

| Test ID | Test Category | Target Endpoint | Expected Status | Actual Status | Verdict | Security Finding / Notes |
|---|---|---|---|---|---|---|
| **ADV-SA-01** | SuperAdminAuth | `GET /permissions` | 403 Forbidden | **200 OK** | **FAIL** | **VULN NEW-SEC-01**: Forged JWT `role: 'super_admin'` allowed access without DB verification. |
| **ADV-SA-02** | SuperAdminAuth | `GET /permissions` | 401 / 403 | **200 OK** | **FAIL** | **VULN NEW-SEC-02**: Blocked Super Admin account allowed full access. |
| **ADV-SA-03** | SuperAdminAuth | `POST /permissions` | 403 Forbidden | **201 Created** | **FAIL** | **VULN NEW-SEC-03**: Staff with `user.manage` demoted Super Admin permissions. |
| **ADV-SA-04** | SuperAdminAuth | `POST /permissions` | 403 Forbidden | 403 Forbidden | **PASS** | Staff self-escalation blocked. |
| **ADV-TI-01** | TenantIsolation | `POST /permissions` | 403 Forbidden | 403 Forbidden | **PASS** | Cross-tenant permission modification blocked. |
| **ADV-SR-01** | SessionRevoc | `POST /auth/login` | 200 OK | 200 OK | **PASS** | Concurrent session setup. |
| **ADV-SR-02** | SessionRevoc | `PATCH /users/change-password` | 200 OK | 200 OK | **PASS** | Password changed in DB. |
| **ADV-SR-03** | SessionRevoc | `GET /users/profile` (Token A) | 401 Unauthorized | 401 Unauthorized | **PASS** | Old access token rejected. |
| **ADV-SR-04** | SessionRevoc | `GET /users/profile` (Token B) | 401 Unauthorized | 401 Unauthorized | **PASS** | Concurrent access token rejected. |
| **ADV-SR-05** | SessionRevoc | `POST /auth/refresh-token` (A) | 401 Unauthorized | 401 Unauthorized | **PASS** | Old refresh token rejected. |
| **ADV-SR-06** | SessionRevoc | `POST /auth/refresh-token` (B) | 401 Unauthorized | 401 Unauthorized | **PASS** | Concurrent refresh token rejected. |
| **ADV-SR-07** | SessionRevoc | `POST /auth/login` (New Pass) | 200 OK | 200 OK | **PASS** | Login with new password succeeded. |
| **ADV-SR-08** | SessionRevoc | `GET /users/profile` (Fresh Token) | 200 OK | 200 OK | **PASS** | Fresh session authenticated. |
| **ADV-SEC-01** | SafeSerializer | `GET /users/profile` | 0 leaked keys | 0 leaked keys | **PASS** | Password & OTP hashes stripped. |
| **ADV-SEC-02** | SafeSerializer | `GET /users/profile` | Observation | `tokenVersion: 2` | **PASS** | `tokenVersion` exposed on user object. |
| **ADV-SEC-03** | SafeSerializer | `PATCH /users/profile-pic` | 0 leaked keys | 0 leaked keys | **PASS** | Avatar response sanitized. |
| **ADV-PE-01** | PendingEntity | `GET /users/profile` | 200 OK | 200 OK | **PASS** | Pending seller allowed own profile. |
| **ADV-PE-02** | PendingEntity | `POST /products` | 403 Forbidden | 403 Forbidden | **PASS** | Pending seller barred from products. |
| **ADV-PE-03** | PendingEntity | `POST /api/payouts/request` | 403 Forbidden | 403 Forbidden | **PASS** | Pending seller barred from payouts. |
| **ADV-VAL-01** | Validation | `POST /permissions` (Empty Body) | 400 Bad Request | 400 Bad Request | **PASS** | Empty payload rejected. |
| **ADV-VAL-02** | Validation | `POST /permissions` (Fake Perm) | 400 Bad Request | 400 Bad Request | **PASS** | Non-canonical permission rejected. |
| **ADV-VAL-03** | Validation | `GET /permissions/:id` (Bad ID) | 400 Bad Request | 400 Bad Request | **PASS** | Malformed ID handled (no 500). |
| **ADV-VAL-04** | Validation | `GET /permissions/user/:id` (Bad) | 400 Bad Request | 400 Bad Request | **PASS** | Malformed userId handled (no 500). |
| **ADV-VAL-05** | Validation | `PATCH /permissions/:id` (Bad ID) | 400 Bad Request | 400 Bad Request | **PASS** | Malformed ID handled on update. |
| **ADV-VAL-06** | Validation | `DELETE /permissions/:id` (Bad ID)| 400 Bad Request | 400 Bad Request | **PASS** | Malformed ID handled on delete. |
| **ADV-VAL-07** | Validation | `GET /permissions/:id` (404 ID)  | 404 Not Found | 404 Not Found | **PASS** | Non-existent ObjectId returns 404. |

---

## 11. Newly Discovered Vulnerabilities

### NEW-SEC-01: PermissionsGuard Super Admin Role Claim Spoofing (CRITICAL)
- **CWE**: CWE-287 (Improper Authentication) / OWASP API5:2023 (Broken Function Level Authorization)
- **Location**: [`src/common/guards/permissions.guard.ts#L167-L175`](file:///E:/nest/first-app/src/common/guards/permissions.guard.ts#L167-L175)
- **Vulnerability**: The guard checks `user.role` from the incoming JWT claims (`roleUpper === 'SUPER_ADMIN' || roleLower === 'super_admin'`). If present, it executes `return true;` immediately.
- **Exploit Scenario**: If an attacker generates, tampers with, or obtains an access token containing `role: 'super_admin'`, they bypass all permission checks on every endpoint guarded by `PermissionsGuard` without the server ever querying MongoDB to verify whether that user actually has the Super Admin role in the database.
- **Fix Required**: Remove the unconditional JWT role bypass at line 167. Ensure Super Admin authorization **always** verifies the user record in MongoDB.

### NEW-SEC-02: Blocked/Inactive Super Admin Account Authorization (HIGH)
- **CWE**: CWE-285 (Improper Authorization)
- **Location**: [`src/common/guards/permissions.guard.ts#L257-L284`](file:///E:/nest/first-app/src/common/guards/permissions.guard.ts#L257-L284)
- **Vulnerability**: While `PermissionsService.isSuperAdmin` checks `actor.status === 'ACTIVE'`, `PermissionsGuard` checks only `dbUserRole` and `dbPerms`. It does **not** check `dbUser.status === 'ACTIVE'`.
- **Exploit Scenario**: If a Super Admin is deactivated, blocked, or suspended by the platform owner, their active tokens continue to execute administrative actions because `PermissionsGuard` grants them `DEFAULT_SUPER_ADMIN_PERMISSIONS` regardless of account status.
- **Fix Required**: In `PermissionsGuard`, check `if (dbUser.status !== AccountStatusEnum.ACTIVE) throw new ForbiddenException('Account is not active');`.

### NEW-SEC-03: Super Admin Account Permission Overwrite / Demotion by Staff (HIGH)
- **CWE**: CWE-269 (Improper Privilege Management)
- **Location**: [`src/modules/permissions/permissions.service.ts#L127-L131`](file:///E:/nest/first-app/src/modules/permissions/permissions.service.ts#L127-L131)
- **Vulnerability**: `PermissionsService.isSuperAdmin` checks only `permissionRepo.getOne({ userId })` to determine whether a target user is a Super Admin. It ignores `actor.permissions` on the `User` collection.
- **Exploit Scenario**: In MongoDB, the platform Super Admin has `platform.super_admin` in `User.permissions`. When an ordinary employee with `user.manage` targets the Super Admin, `isSuperAdmin(targetUserId)` returns `false`. The protection check at line 164 is bypassed, and the employee successfully demotes or alters the Super Admin's permissions.
- **Fix Required**: In `PermissionsService.isSuperAdmin`, check both `actor.permissions` (from `userRepo`) AND `permDoc.permissions` (from `permissionRepo`).

---

## 12. Recommended Remediation Action Plan

To transition the module to production-ready status, execute the following targeted corrections:

1. **Harden `PermissionsGuard` Super Admin Verification**:
   - In [`src/common/guards/permissions.guard.ts`](file:///E:/nest/first-app/src/common/guards/permissions.guard.ts), remove lines 167–175 (the raw JWT role bypass).
   - Require that any Super Admin assertion verifies `dbUser.status === AccountStatusEnum.ACTIVE` and `dbUser.isEmailVerified === true` from MongoDB.
2. **Align Super Admin Identification in `PermissionsService`**:
   - In [`src/modules/permissions/permissions.service.ts#isSuperAdmin`](file:///E:/nest/first-app/src/modules/permissions/permissions.service.ts#L127), merge `actor.permissions` from `userRepo` with `permDoc.permissions` from `permissionRepo` so Super Admins defined on the `User` model are fully protected.
3. **Resolve Cache Dual-Key & Double-Increment**:
   - Standardize on `auth:token_version:${userId}` across all guards and services.
   - In `PermissionsService.invalidateTokenVersion`, remove the redundant `store.client.incr` call after `cacheService.set` to avoid the double-increment divergence.
   - In `AuthService.generateTokens`, query MongoDB for `tokenVersion` if the cache is cold, rather than defaulting to `1`.
4. **Omit `tokenVersion` from User Responses**:
   - In [`src/common/utils/safe-user.serializer.ts`](file:///E:/nest/first-app/src/common/utils/safe-user.serializer.ts), add `tokenVersion` to the destructured omitted fields to prevent internal counter exposure.

---

## 13. Audit Sign-Off

This independent code review and adversarial test suite confirms that while significant progress was achieved in the initial remediation, **critical privilege escalation vectors remain in Super Admin authorization and account guarding**. 

The module is classified as **`REQUIRES FURTHER REMEDIATION`** prior to integration testing or production deployment.

