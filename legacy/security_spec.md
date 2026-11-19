# Security Specification — Aghrin PishFactor

## 1. Data Invariants
1. **Authentication & Verification**: All database reads and writes require an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
2. **Role-Based Access Control (RBAC)**:
   - Only `admin` (`agrin.sazan@gmail.com` or active users with `role == 'admin'` in `/users/{uid}`) can manage users, staff invites, company settings, product categories, products, and delete records or view full audit logs.
   - Active `sales` staff can read products/categories/company settings, read/create/update customers, create/read/update their own non-terminal quotations (`createdByUid == request.auth.uid`), and append audit logs authored by themselves.
   - Users can never self-assign `role: 'admin'` during account creation or elevate their own `role` or `isActive` status on profile update.
3. **Immutable Snapshots & Relational Integrity**:
   - Quotation line items live in `/quotations/{quotationId}/items/{itemId}` and require parent quotation existence and authorization via `get()`.
   - Status transitions on quotations are logged in `/quotations/{quotationId}/status_history/{historyId}`.
   - Once a quotation reaches terminal status (`تاییدشده` or `لغوشده`), non-admin users cannot modify it.
4. **Strict Timestamps & Payload Bounds**:
   - Every string field has explicit `.size()` bounds; every document ID is validated via `isValidId()`; `createdAt`/`updatedAt`/`changedAt` use `request.time`.

## 2. Dirty Dozen Attack Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read/write to `/quotations/q1`.
2. Unverified email user (`email_verified: false`) trying to spoof admin email `agrin.sazan@gmail.com`.
3. Non-admin user creating `/users/{uid}` with `role: 'admin'`.
4. Non-admin user updating their own `/users/{uid}` to set `role: 'admin'` or `isActive: true`.
5. Non-admin user reading another user's `/users/{otherUid}` PII.
6. Non-admin user updating `/company_settings/main`.
7. Non-admin user creating or deleting `/products/{productId}`.
8. Shadow field injection (`isVerified: true`) on `/customers/{customerId}` create.
9. Oversized ID injection (200-char doc ID) on `/customers/{200chars}`.
10. Sales user reading or updating another sales user's `/quotations/{otherQuotationId}`.
11. Sales user updating a quotation already in terminal state `تاییدشده`.
12. Any user modifying or deleting an existing `/audit_logs/{logId}` entry.
