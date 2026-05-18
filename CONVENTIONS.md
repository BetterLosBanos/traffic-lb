# Code Conventions

> Authoritative reference for this codebase.
> When in doubt, consistency within this document takes precedence over external conventions.

---

## Table of Contents

1. [Architecture Boundaries](#architecture-boundaries)
2. [Boolean Naming](#boolean-naming)
3. [Function Naming](#function-naming)
4. [Event Handlers](#event-handlers)
5. [Types vs Interfaces](#types-vs-interfaces)
6. [API Contract](#api-contract)
7. [HTTP Status Codes](#http-status-codes)
8. [TypeScript](#typescript)
9. [React Components](#react-components)
10. [Error Handling](#error-handling)
11. [Database & Backend](#database--backend)
12. [Git Commits](#git-commits)

---

## Architecture Boundaries

Systems that have role-based access, feature flags, or configuration presets must
keep those concerns strictly separate. Each answers a different question and must
never substitute for another.

| Layer        | Question it answers                        |
|--------------|--------------------------------------------|
| Config/type  | What kind of thing is this?                |
| Permissions  | What is this actor allowed to do?          |
| Feature flags| Is this functionality enabled right now?   |

```typescript
// ❌ Branching on entity type directly — breaks as types multiply
if (org.type === "premium") { ... }

// ✅ Branch on capabilities for permissions and data shape
if (capabilities.includes("advanced_reporting")) { ... }

// ✅ Use feature flags for execution paths (routes, UI, logic)
if (isFeatureEnabled("reporting")) { ... }
```

### Split role-scoped surfaces into separate components

Any UI surface that differs meaningfully by role gets two separate components on
two separate routes, not one component with `isAdmin` branching. A member page
never checks for admin. An admin page never needs to — it is behind a guard.

```typescript
// ❌ One component doing two jobs
export default function PaymentsPage() {
  const isAdmin = isAdminRole(user.role);
  if (isAdmin) { /* admin UI */ } else { /* member UI */ }
}

// ✅ Two pages, two routes, one job each
// /payments        → PaymentsPage       (member: own balance)
// /admin/payments  → AdminPaymentsPage  (admin: all balances, review)
```

### Role checks — never compare strings directly

```typescript
// ❌ Hardcoded role strings break when roles are renamed or extended
if (user.role === "admin" || user.role === "superadmin") { ... }

// ✅ Use role helpers
import { isAdminRole, isAtLeast, hasRole } from "@/lib/roles";

if (isAdminRole(user.role)) { ... }
if (isAtLeast(user.role, "admin")) { ... }
```

---

## Boolean Naming

All boolean fields use the `is` prefix without exception.

```typescript
// TypeScript — always is-prefixed
isPublished: boolean;
isActive: boolean;
isVerified: boolean;

// SQL columns — snake_case, no prefix required by DB convention
published, active, is_verified
```

### SQLite booleans — always `0`/`1` integer

```typescript
// Read from DB
const isActive = Boolean(row.is_active);

// Write to DB
.bind(isActive ? 1 : 0)
```

---

## Function Naming

Use consistent verb prefixes based on what a function does.

### Data fetching

```typescript
getUser(id);             // single record, often sync or cached
listTransactions();      // collection
fetchUserAccess(userId); // async, external or network-dependent
```

### Mutations

```typescript
createBooking(input);
updateMember(id, input);
deleteAnnouncement(id);
markDelinquent(id);      // domain action with specific meaning, not a generic update
```

### Guards and checks

```typescript
canAccessResource(userId, resourceId);
hasPermission(role, permission);
isValidRole(role);
isAtLeast(role, minimum);
isAdminRole(role);
```

### Helpers and utilities

```typescript
formatDate(dateStr);
validateMetadata(type, metadata);
buildQueryParams(filters);
```

---

## Event Handlers

`on` prefix for props, `handle` prefix for implementations.

```typescript
// Props — what the parent passes in
interface FormProps {
  onSubmit: () => void;
  onCancel: () => void;
}

// Implementations — what the component defines internally
const handleSubmit = () => { ... };
const handleCancel = () => { ... };

// JSX
<Form onSubmit={handleSubmit} onCancel={handleCancel} />
```

This distinction makes it immediately clear at a glance whether you are looking
at a callback contract or a local function.

---

## Types vs Interfaces

```typescript
// Use interface for object shapes — extendable, mergeable
interface Booking { ... }
interface CreateBookingInput { ... }

// Use type for unions, aliases, computed types
type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
type OrgType = 'premium' | 'standard' | 'trial';
```

### Input types are always separate from entity types

```typescript
// Full entity — returned from DB/API, includes all fields
interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// Create input — no id, no timestamps
interface CreateUserInput {
  email: string;
  name: string;
}

// Update input — all optional
interface UpdateUserInput extends Partial<CreateUserInput> {}
```

Never accept `id` or timestamps from a client payload. Those are server concerns.

### Explicit return types on all exported functions

```typescript
// ❌ Return type inferred — can change silently as implementation changes
export function getPermissions(params) { ... }

// ✅ Contract is explicit and stable
export function getPermissions(params: PermissionParams): string[] { ... }
```

---

## API Contract

### Request bodies — always camelCase

```typescript
{ bookingDate: "2026-01-15", isPaid: false, resourceId: "abc" }
```

### Response bodies — always camelCase, consistent shape

```typescript
// Single record
{ data: Booking }

// Collection
{ data: Booking[], total: number }

// Error
{ error: string, code?: string }

// Success with no data (DELETE, etc.)
{ success: true }
```

Never mix shapes. All collection responses use `{ data: [] }`.

### camelCase / snake_case boundary

| Layer                        | Convention  | Example                      |
|------------------------------|-------------|------------------------------|
| Frontend (React, TypeScript) | camelCase   | `userId`, `isPinned`         |
| API request/response bodies  | camelCase   | `{ userId: '...' }`          |
| Backend route handlers       | camelCase   | `const { userId } = body`    |
| SQL queries                  | snake_case  | `user_id`, `is_pinned`       |
| Database columns             | snake_case  | `user_id`, `published_at`    |

Translation always happens inside the route handler, nowhere else. Never leak
snake_case into the frontend or camelCase into SQL.

```typescript
// Route handler — correct translation pattern
const { userId, isPinned, publishedAt } = await req.json();

await db
  .prepare(`UPDATE posts SET user_id = ?, is_pinned = ?, published_at = ? WHERE id = ?`)
  .bind(userId, isPinned ? 1 : 0, publishedAt, id)
  .run();
```

---

## HTTP Status Codes

Be precise. Never use 200 for everything.

| Code | Meaning               | When to use                              |
|------|-----------------------|------------------------------------------|
| 200  | OK                    | Success with response body               |
| 201  | Created               | Successful POST that creates a resource  |
| 204  | No Content            | Successful DELETE or action with no body |
| 400  | Bad Request           | Validation error, malformed input        |
| 401  | Unauthorized          | Not authenticated                        |
| 403  | Forbidden             | Authenticated but not authorized         |
| 404  | Not Found             | Resource does not exist                  |
| 409  | Conflict              | Duplicate, overlap, constraint violation |
| 429  | Too Many Requests     | Rate limit exceeded                      |
| 500  | Internal Server Error | Unhandled server error                   |

---

## TypeScript

### No `any` — ever

```typescript
// ❌
const data: any = await response.json();

// ✅ Cast to known type
const data = (await response.json()) as BookingResponse;

// ✅ Narrow unknown
const raw: unknown = await response.json();
```

### No implicit undefined in nullable fields

```typescript
// ❌ Ambiguous — is this required or just missing?
interface Booking {
  orgUnitId: string;
}

// ✅ Explicit intent
interface Booking {
  orgUnitId?: string;          // optional — may not exist
  receiptNumber: string | null; // nullable — always present, may be null
}
```

### Avoid magic strings — use type aliases

```typescript
// ❌
if (booking.status === 'confirmed') { ... }

// ✅ Now type-checked and autocompleted
type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
if (booking.status === 'confirmed') { ... }
```

### Nullish coalescing — use `??` not `||`

```typescript
// ❌ Swallows 0, "", and false
const count = response.count || 0;

// ✅ Only triggers on null or undefined
const count = response.count ?? 0;
```

### Avoid inline object and array literals in JSX

```typescript
// ❌ New reference every render — triggers unnecessary re-renders
<Select options={['a', 'b', 'c']} />

// ✅ Stable reference
const OPTIONS = ['a', 'b', 'c'] as const;
<Select options={OPTIONS} />
```

---

## React Components

### Props interface naming — always `<ComponentName>Props`

```typescript
interface BookingCardProps {
  booking: Booking;
  onEdit?: () => void;
  isEditable?: boolean;
}

export function BookingCard({ booking, onEdit, isEditable = false }: BookingCardProps) {
  ...
}
```

### One component per file, filename matches component name

```
BookingCard.tsx       → export function BookingCard
AdminBookingsPage.tsx → export default function AdminBookingsPage
```

### Default exports for pages, named exports for components

```typescript
// Pages — lazy loaded via router
export default function BookingsPage() { ... }

// Components — imported directly, tree-shakeable
export function BookingCard() { ... }
export function PricingBreakdown() { ... }
```

### Query key conventions

All query keys go through a central factory. No hardcoded arrays in pages or hooks.

```typescript
// ❌ Drifts, makes invalidation unpredictable
useQuery({ queryKey: ['bookings', userId], ... });

// ✅ Central factory
import { queryKeys } from '@/lib/query-keys';
useQuery({ queryKey: queryKeys.bookings.list({ userId }), ... });
queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
```

Add a key to `src/lib/query-keys.ts` before adding any hook that uses it.

---

## Error Handling

### Never swallow errors silently

```typescript
// ❌ Bug is now invisible
try {
  await doSomething();
} catch (e) {}

// ✅ Always log and rethrow or handle explicitly
try {
  await doSomething();
} catch (error) {
  console.error('[BookingForm] submit failed:', error);
  throw error;
}
```

### Backend errors always include context

```typescript
// ❌ Useless in a log
throw new Error('Not found');

// ✅ Debuggable without a debugger
throw new Error(`Booking ${bookingId} not found for user ${userId}`);
```

### Frontend errors always surface to the user

```typescript
onError: (error: Error) => {
  toast.error(error.message || 'Something went wrong. Please try again.');
},
```

An error that disappears into a log is invisible to the person who needs to act on it.

---

## Database & Backend

### Never use string concatenation in SQL

```typescript
// ❌ SQL injection risk
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ Always parameterized
await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
```

### Batch related writes — always atomic

```typescript
// ❌ Two separate awaits — partial failure leaves data inconsistent
await db.prepare('INSERT INTO orders ...').bind(...).run();
await db.prepare('INSERT INTO order_items ...').bind(...).run();

// ✅ Atomic batch
await db.batch([
  db.prepare('INSERT INTO orders ...').bind(...),
  db.prepare('INSERT INTO order_items ...').bind(...),
]);
```

### IDs — always generated server-side

```typescript
// ❌ Never trust client-provided IDs
const { id } = await req.json();

// ✅ Generate server-side
const id = crypto.randomUUID();
```

### Timestamps — one format everywhere

```sql
-- Standard: human-readable, sorts correctly as a string
created_at TEXT NOT NULL DEFAULT (datetime('now'))
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
```

Every UPDATE must include `updated_at = datetime('now')`. No exceptions.

### Lifecycle state — use dedicated action endpoints

Generic `PUT /resource/:id` endpoints update descriptive fields only. Status
transitions with rules (publish, approve, archive) use explicit action endpoints.

```typescript
// ✅ Descriptive update and lifecycle transition are separate contracts
await updatePost({ id, data: { title, body } });
await publishPost({ id });
```

### Audit logging — always log security-relevant actions

```typescript
await logAuditEvent(db, {
  userId: actor.id,
  action: 'booking.created',
  resourceType: 'booking',
  resourceId: booking.id,
  success: true,
});
```

### Financial records — always explicit direction

```typescript
// ❌ Inferring direction from sign or context
await createTransaction(db, { amount: -500 });

// ✅ Always explicit
await createTransaction(db, { amount: 500, direction: 'outflow' });
```

---

## Git Commits

Conventional commits format. One concern per commit.

```
feat(auth): add refresh token rotation
fix(bookings): prevent double-submit on slow connections
chore(deps): upgrade react-query to v5
refactor(permissions): extract role helpers into lib/roles
docs: update API contract section in CONVENTIONS.md
test(bookings): add overlap conflict case
perf(dashboard): memoize permission derivation
```

### Prefixes

| Prefix     | When to use                          |
|------------|--------------------------------------|
| `feat`     | New feature or capability            |
| `fix`      | Bug fix                              |
| `chore`    | Maintenance, dependencies, config    |
| `refactor` | Code change with no behavior change  |
| `docs`     | Documentation only                   |
| `test`     | Tests only                           |
| `perf`     | Performance improvement              |

The git history is documentation. Future contributors should be able to read it
and understand what decisions were made and why. Never bundle unrelated changes
in one commit.

---

## Summary Cheatsheet

| Concern               | Convention                                              |
|-----------------------|---------------------------------------------------------|
| Role checks           | Helper functions, never `=== "admin"`                   |
| Feature access        | Feature flags, not capability checks                    |
| Admin vs member UI    | Separate routes and components, no `isAdmin` branching  |
| Boolean fields        | `is` prefix always (`isPublished`, `isActive`)          |
| Fetch functions       | `get` / `list` / `fetch` prefix                         |
| Mutation functions    | `create` / `update` / `delete` / domain verb            |
| Event props           | `on` prefix (`onClose`, `onSubmit`)                     |
| Event implementations | `handle` prefix (`handleClose`, `handleSubmit`)         |
| Object shapes         | `interface`                                             |
| Unions / aliases      | `type`                                                  |
| Props interface       | `<ComponentName>Props`                                  |
| Page exports          | `export default`                                        |
| Component exports     | Named `export`                                          |
| Frontend casing       | camelCase                                               |
| DB column casing      | snake_case                                              |
| API bodies            | camelCase                                               |
| SQL queries           | Parameterized `.bind()` only                            |
| SQLite booleans       | `0`/`1`, wrap in `Boolean()` on read                   |
| DB timestamps         | `TEXT NOT NULL DEFAULT (datetime('now'))` always        |
| Nullish coalescing    | `??` not `\|\|`                                         |
| Related DB writes     | Always `db.batch()`                                     |
| IDs                   | Server-generated, never client-provided                 |
| Financial direction   | Always explicit `inflow` or `outflow`                   |
| Commit format         | Conventional commits, one concern per commit            |
| Any type              | Never                                                   |
| Magic strings         | Never — use type aliases                                |
| Inline JSX literals   | Never — declare as constants outside JSX                |
| Silent catch blocks   | Never — always log and rethrow or handle explicitly     |