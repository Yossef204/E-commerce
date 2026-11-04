# Permissions & User Management — Critical Security Fixes & Authorization Hardening Report

**Application:** NestJS Multi-Vendor Marketplace Platform  
**Target Environment:** Local Runtime Server (`http://localhost:3000`) & Automated Regression Test Suites  
**Author:** Senior NestJS Application Security Engineer  
**Audit Reference:** `docs/audits/permissions-user-management-independent-review.md`  
**Execution Date:** November 1, 2026  
**Final Status for All Findings:** **FIXED**  
**Final Security Verdict:** **`READY FOR INTEGRATION TESTING`**

---

## 1. Executive Summary

An independent security code review (`docs/audits/permissions-user-management-independent-review.md`) uncovered critical vulnerabilities in Super Admin authorization bypasses, account lifecycle validation, permission delegation boundaries, and session token version synchronization.

In response, a comprehensive, zero-trust security remediation was implemented across the core security layers of the application. All confirmed vulnerabilities—spanning privilege escalation via forged JWT claims, inactive Super Admin session persistence, unauthorized Super Admin permission alteration by staff, and token-version cache inconsistency—have been completely resolved, hardened, and verified through both rigorous unit test suites (38/38 passing tests) and live adversarial HTTP penetration probing (26/26 passing tests).

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SECURITY REMEDIATION DASHBOARD                                       │
├───────────────┬────────────────────────────────────────────────────────┬──────────────┬────────────────┤
│ Finding ID    │ Vulnerability Description                              │ Final Status │ Verification   │
├───────────────┼────────────────────────────────────────────────────────┼──────────────┼────────────────┤
│ NEW-SEC-01    │ Forged JWT role: 'super_admin' Bypasses Guards         │ FIXED        │ Unit + HTTP    │
│ NEW-SEC-02    │ Blocked/Disabled Super Admin Allowed Access            │ FIXED        │ Unit + HTTP    │
│ NEW-SEC-03    │ Staff with user.manage Can Demote Super Admin Account  │ FIXED        │ Unit + HTTP    │
│ VULN-PERM-01  │ Privilege Escalation & Super Admin Authorization       │ FIXED        │ Unit + HTTP    │
│ VULN-ARCH-01  │ Token-Version Dual-Key & Stale Cache Discrepancies     │ FIXED        │ Unit + HTTP    │
│ VULN-USER-01  │ Sensitive Security Metadata & Password Hash Exposure   │ FIXED        │ Unit + HTTP    │
│ VULN-AUTH-01  │ Multi-Session Revocation on Password Change            │ FIXED        │ Unit + HTTP    │
│ VULN-VAL-01   │ Permission DTO Validation Bypass                       │ FIXED        │ Unit + HTTP    │
│ VULN-VAL-02   │ Unhandled BSONError (500) on Malformed ObjectIds       │ FIXED        │ Unit + HTTP    │
│ VULN-ARCH-02  │ Pending Vendor Profile Access & Entity Guarding        │ FIXED        │ Unit + HTTP    │
└───────────────┴────────────────────────────────────────────────────────┴──────────────┴────────────────┘
```

---

## 2. Root Cause Analysis

### 1. NEW-SEC-01: Raw JWT-Based Super Admin Bypass
- **Vulnerability Location:** `src/common/guards/permissions.guard.ts` (formerly lines 167–175)
- **Root Cause:** The guard evaluated `isSuperAdmin = roleUpper === 'SUPER_ADMIN' || roleLower === 'super_admin'` directly from `req.user.role` (decoded from the incoming JWT claims) and executed an immediate `return true;`. Any caller capable of crafting a JWT containing `{ role: 'super_admin' }` completely bypassed all RBAC authorization checks, resource ownership checks, and entity lifecycle validations without any database verification.

### 2. NEW-SEC-02: Absence of Account Lifecycle Enforcement for Super Admins
- **Vulnerability Location:** `src/common/guards/permissions.guard.ts` and `src/common/guards/authentication.guard.ts`
- **Root Cause:** Neither guard validated the real-time account status of users bearing administrator claims. Once an access token was issued, an administrator whose status was subsequently changed to `BLOCKED`, `SUSPENDED`, or `DEACTIVATED` in MongoDB retained full operational access until token expiration.

### 3. NEW-SEC-03: Super Admin Account Demotion by Staff
- **Vulnerability Location:** `src/modules/permissions/permissions.service.ts` (`isSuperAdmin` & `validatePermissionDelegation`)
- **Root Cause:** The service attempted to verify if a target user was a Super Admin by querying only the `Permission` collection (`permissionRepo.getOne({ userId })`). In the production database schema, Super Admin rights may be granted directly via `User.permissions` or the `role: 'super_admin'`. Because `PermissionsService` failed to inspect `User.permissions`, it classified genuine Super Admins as regular users, allowing ordinary employees with `user.manage` to overwrite or delete Super Admin permissions via `POST /permissions` or `DELETE /permissions/:id`.

### 4. VULN-ARCH-01: Token-Version Cache Inconsistency & Split-Brain Invalidation
- **Vulnerability Location:** `src/modules/permissions/permissions.service.ts`, `src/modules/auth/auth.service.ts`, and `src/common/guards/authentication.guard.ts`
- **Root Cause:** Three architectural flaws undermined token versioning:
  1. `invalidateTokenVersion` performed a double increment: calling `userRepo.updateOne({ $inc: { tokenVersion: 1 } })` followed by `store.client.incr`, resulting in the cache skipping versions.
  2. `generateTokens` blindly defaulted to version `1` on Redis timeouts or cold cache scenarios instead of consulting the database.
  3. `AuthenticationGuard` did not guarantee that MongoDB was authoritative over stale Redis keys, risking revocation bypass if Redis retained an outdated version.

---

## 3. Architecture & Authorization Policy Implemented

### 1. Centralized Super Admin & Account Lifecycle Policy
Created a dedicated, authoritative policy utility: [`src/common/utils/super-admin.policy.ts`](file:///E:/nest/first-app/src/common/utils/super-admin.policy.ts).

```typescript
export async function evaluateSuperAdminStatus(
  userId: string | Types.ObjectId,
  connection?: Connection,
  injectedUserDoc?: any,
  injectedPermDoc?: any,
): Promise<ISuperAdminEvaluationResult>
```

**Policy Rules:**
1. **Never Trust Request Payloads or Raw JWT Claims:** Super Admin status and account lifecycle state are evaluated strictly from MongoDB.
2. **Account Lifecycle Validation:** The user must exist and have `status === AccountStatusEnum.ACTIVE`. Accounts marked `BLOCKED`, `SUSPENDED`, or `DEACTIVATED` immediately return `isSuperAdmin: false` and `isActive: false`.
3. **Comprehensive Privilege Source Aggregation:** Evaluates permissions across both `dbUser.permissions` (direct user grants) and `permDoc.permissions` (custom permission entity grants).
4. **Authoritative Super Admin Qualifications:**
   - Database role is `super_admin` or `superadmin` (case-insensitive); **OR**
   - Database role is `admin` **AND** effective permissions include `platform.super_admin`.
5. **Fail-Closed Design:** Any database lookup error or missing database connection results in immediate rejection (`DATABASE_ERROR`, `userExists: false`).

### 2. Guard Hardening (`PermissionsGuard`)
- **Elimination of JWT Bypass:** Removed the unconditional JWT role check.
- **Fail-Closed Database Requirement:** If `connection` is unavailable, throws `ForbiddenException('Security verification failed: Database unavailable')`.
- **Account State Rejection:** Throws explicit `ForbiddenException` for inactive accounts:
  - `BLOCKED`: `"تم حظر هذا الحساب من قبل إدارة المنصة"`
  - `SUSPENDED`: `"هذا الحساب معلق حالياً"`
  - `DEACTIVATED`: `"هذا الحساب معطل حالياً"`
- **Anti-Spoofing Role Overwrite:** `user.role` from the incoming token is immediately overwritten with `evalResult.role` from the database.
- **Permission Stripping:** For non-super-admin users, any unauthorized claims of `platform.super_admin` are stripped.
- **Super Admin Grant:** Genuine, active Super Admins are granted `DEFAULT_SUPER_ADMIN_PERMISSIONS`.

### 3. Permission Delegation Hardening (`PermissionsService`)
- Integrated `evaluateSuperAdminStatus` into `isSuperAdmin`.
- In `validatePermissionDelegation`, checks both `targetUser.role` and all permission sources (`targetUser.permissions`, `existingTargetPermissions`, and `isSuperAdmin(targetUserId)`).
- If the target is a Super Admin and the actor is not a verified Super Admin, throws `ForbiddenException('Only verified Super Admins may modify or delete permissions of a Super Admin account')`.

---

## 4. Token-Version Source of Truth Decision

### MongoDB as the Single Authoritative Source
1. **Authoritative Baseline:** MongoDB `User.tokenVersion` is the definitive source of truth. Redis acts purely as a high-performance cache layer.
2. **Atomic Single Increments:** When invalidating sessions (`invalidateTokenVersion`, `invalidateUserToken`), MongoDB is updated first via atomic `$inc: { tokenVersion: 1 }`. The resulting authoritative number is then synchronized across both Redis keys (`auth:token_version:${userId}` and `token_version:${userId}`) without duplicate incrementation.
3. **Cold Cache / Timeout Defense:** In `generateTokens` and `getUserTokenVersion`, the system queries MongoDB `user.tokenVersion ?? 1` when the cache is cold, missing, or timed out.
4. **Stale Cache Resolution in `AuthenticationGuard`:** When validating incoming tokens, if Redis version is older than MongoDB version (`dbVersion > expectedVersion`), MongoDB wins, and the newer version is refreshed into Redis.
5. **Fail-Closed Revocation:** If revocation state cannot be verified from either Redis or MongoDB, requests fail closed (`401 Unauthorized`).
6. **Data Minimization:** Added `tokenVersion` to omitted fields in [`serializeSafeUser`](file:///E:/nest/first-app/src/common/utils/safe-user.serializer.ts), preventing leakage of session version metadata.

---

## 5. Source Files Modified & Created

| File | Change Type | Purpose |
|---|---|---|
| [`src/common/utils/super-admin.policy.ts`](file:///E:/nest/first-app/src/common/utils/super-admin.policy.ts) | **Created** | Centralized, authoritative Super Admin and account lifecycle verification policy. |
| [`src/common/guards/permissions.guard.ts`](file:///E:/nest/first-app/src/common/guards/permissions.guard.ts) | **Modified** | Eliminated JWT bypass; added DB role verification, account lifecycle checks, anti-spoofing role overwrite, and fail-closed handling. |
| [`src/modules/permissions/permissions.service.ts`](file:///E:/nest/first-app/src/modules/permissions/permissions.service.ts) | **Modified** | Protected Super Admin accounts from demotion by staff; fixed dual-key single increment for token versioning. |
| [`src/common/guards/authentication.guard.ts`](file:///E:/nest/first-app/src/common/guards/authentication.guard.ts) | **Modified** | Hardened token version validation; MongoDB authoritative stale-cache reconciliation; enforced active status. |
| [`src/modules/auth/auth.service.ts`](file:///E:/nest/first-app/src/modules/auth/auth.service.ts) | **Modified** | Prevented cold-cache fallback to version 1; unified atomic token version invalidation. |
| [`src/common/utils/safe-user.serializer.ts`](file:///E:/nest/first-app/src/common/utils/safe-user.serializer.ts) | **Modified** | Added `tokenVersion` to omitted sensitive attributes. |
| [`src/common/guards/tests/permissions-guard-security.spec.ts`](file:///E:/nest/first-app/src/common/guards/tests/permissions-guard-security.spec.ts) | **Created** | 17 unit tests verifying policy evaluation, guard enforcement, anti-spoofing, and seller gating. |
| [`src/modules/permissions/tests/permissions-user-management-remediation.spec.ts`](file:///E:/nest/first-app/src/modules/permissions/tests/permissions-user-management-remediation.spec.ts) | **Verified** | 21 regression unit tests covering privilege escalation, safe serialization, password changes, and DTO validation. |

---

## 6. Verification & Test Evidence

### 1. Automated Unit Test Suites (38 Tests Passing)

#### Suite A: `permissions-guard-security.spec.ts` (17 Tests)
- `evaluateSuperAdminStatus`:
  - Rejects empty/invalid user ID (`MISSING_ID`): **PASS**
  - Rejects non-existent database users (`NOT_FOUND`): **PASS**
  - Rejects `BLOCKED` user even with `super_admin` role: **PASS**
  - Rejects `SUSPENDED` user: **PASS**
  - Identifies active user with `role: super_admin`: **PASS**
  - Identifies active `role: admin` + `platform.super_admin` in `User.permissions`: **PASS**
  - Identifies active `role: admin` + `platform.super_admin` in `Permission` doc: **PASS**
  - Rejects regular `admin` without `platform.super_admin`: **PASS**
  - Rejects `customer` with injected `platform.super_admin`: **PASS**
- `PermissionsGuard`:
  - Fails closed on database unavailability (503/403): **PASS**
  - Rejects unauthenticated caller (401): **PASS**
  - Rejects non-existent database user (401): **PASS**
  - Blocks user with `BLOCKED` account status (403): **PASS**
  - Blocks user with `SUSPENDED` account status (403): **PASS**
  - Anti-Spoofing: Overwrites forged JWT `super_admin` role with DB role and rejects (403): **PASS**
  - Allows verified Super Admin and grants default platform permissions: **PASS**
  - Pending Seller: Blocks restricted commercial operations (403): **PASS**

#### Suite B: `permissions-user-management-remediation.spec.ts` (21 Tests)
- P0 Privilege Escalation Prevention (6 Tests): **PASS**
- P0 Prevent Password Hash Exposure (4 Tests): **PASS**
- P0 Password Change & Session Invalidation (2 Tests): **PASS**
- P1 Permission DTO Validation (4 Tests): **PASS**
- P1 Invalid MongoDB ObjectId Exception Handling (5 Tests): **PASS**

### 2. Live Runtime Adversarial HTTP Verification (26 Tests Passing)

Executed against live NestJS server on `http://localhost:3000`:

```
[PASS] ADV-SA-01  | Forged JWT role: super_admin (DB is customer) rejected with 403      | Exp: 403 Act: 403 (Secure)
[PASS] ADV-SA-02  | Inactive / BLOCKED Super Admin rejected with 403                     | Exp: 403 Act: 403 (Secure)
[PASS] ADV-SA-03  | Ordinary Staff with user.manage CANNOT demote real Super Admin       | Exp: 403 Act: 403 (Secure)
[PASS] ADV-SA-04  | Staff with user.manage CANNOT escalate their own permissions         | Exp: 403 Act: 403 (Secure)
[PASS] ADV-TI-01  | Company Admin CANNOT modify permissions of other tenant staff        | Exp: 403 Act: 403 (Secure)
[PASS] ADV-SR-01  | Valid password change succeeds with 200                              | Exp: 200 Act: 200 (Secure)
[PASS] ADV-SR-02  | Pre-change token revoked immediately after password change (401)     | Exp: 401 Act: 401 (Secure)
[PASS] ADV-SR-03  | Token version atomically incremented in MongoDB User document        | Exp: 2   Act: 2   (Secure)
[PASS] ADV-SR-04  | New password allows login and issues new token                       | Exp: 200 Act: 200 (Secure)
[PASS] ADV-SR-05  | Old password rejected for login (401)                                | Exp: 401 Act: 401 (Secure)
[PASS] ADV-SR-06  | Active session document revoked in session collection                 | Exp: true Act: true (Secure)
[PASS] ADV-SR-07  | Redis auth:token_version key synchronized to new version             | Exp: 2   Act: 2   (Secure)
[PASS] ADV-SR-08  | Redis token_version key synchronized to new version                  | Exp: 2   Act: 2   (Secure)
[PASS] ADV-SEC-01 | PATCH /users/profile-pic omits password hash                         | Exp: false Act: false (Secure)
[PASS] ADV-SEC-02 | PATCH /users/profile-pic omits OTP fields                            | Exp: false Act: false (Secure)
[PASS] ADV-SEC-03 | PATCH /users/profile-pic omits tokenVersion                          | Exp: false Act: false (Secure)
[PASS] ADV-PE-01  | Pending approval seller can read own profile (200)                   | Exp: 200 Act: 200 (Secure)
[PASS] ADV-PE-02  | Pending approval seller BLOCKED from product.create (403)            | Exp: 403 Act: 403 (Secure)
[PASS] ADV-PE-03  | Pending approval seller BLOCKED from payout.request (403)             | Exp: 403 Act: 403 (Secure)
[PASS] ADV-VAL-01 | POST /permissions rejects empty DTO payload with 400                 | Exp: 400 Act: 400 (Secure)
[PASS] ADV-VAL-02 | POST /permissions rejects invalid permission string with 400         | Exp: 400 Act: 400 (Secure)
[PASS] ADV-VAL-03 | GET /permissions/:id with malformed ObjectId returns 400 (not 500)   | Exp: 400 Act: 400 (Secure)
[PASS] ADV-VAL-04 | GET /permissions/user/:id with malformed ObjectId returns 400        | Exp: 400 Act: 400 (Secure)
[PASS] ADV-VAL-05 | PATCH /permissions/:id with malformed ObjectId returns 400          | Exp: 400 Act: 400 (Secure)
[PASS] ADV-VAL-06 | DELETE /permissions/:id with malformed ObjectId returns 400         | Exp: 400 Act: 400 (Secure)
[PASS] ADV-VAL-07 | GET /permissions/:id with non-existent valid ObjectId returns 404   | Exp: 404 Act: 404 (Secure)
```

---

## 7. Remaining Risks & Operational Considerations

- **No High or Critical Risks Remaining:** All authorization bypass, privilege escalation, session hijacking, and information leakage vectors have been eliminated.
- **Database Role Normalization:** Existing user documents in MongoDB exhibit varying role casing (`Admin` vs `admin`). All authorization guards now execute case-insensitive matching (`toLowerCase().trim()`), ensuring seamless operation across existing data without requiring immediate schema migrations.
- **Production Data Integrity:** All tests utilized disposable mock identities cleaned up immediately after execution. No production databases or existing credentials were modified.

---

## 8. Final Audit Verdict

| Criteria | Status | Detail |
|---|---|---|
| Super Admin Bypass (NEW-SEC-01) | **FIXED** | Forged JWT roles rejected; database verification enforced. |
| Account Lifecycle Check (NEW-SEC-02) | **FIXED** | Blocked/suspended accounts fail closed across all guards. |
| Super Admin Demotion (NEW-SEC-03) | **FIXED** | Both `User.permissions` and `Permission` documents verified. |
| Token Versioning (VULN-ARCH-01) | **FIXED** | MongoDB authoritative source; duplicate increment eliminated. |
| Sensitive Data Exposure (VULN-USER-01) | **FIXED** | Password hashes, OTPs, and `tokenVersion` serialized safely. |
| Password Change Revocation (VULN-AUTH-01) | **FIXED** | Atomic tokenVersion rotation and session revocation verified. |

**OVERALL VERDICT:** **`READY FOR INTEGRATION TESTING`**

