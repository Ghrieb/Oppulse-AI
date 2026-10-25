# Authentication decision record

**Status:** decided, and implemented in one system only.
**Decision:** the FastAPI service owns the identity lifecycle. Supabase is Postgres and private
Storage; **Supabase Auth is not used.**

This is the record the Phase B brief asks for before any authentication is implemented: the
comparison, the reasoning, the migration implications, and what the chosen system has to cover.
The architecture note that follows from it is ADR‑A20 in [`architecture.md`](./architecture.md).

---

## 1. The comparison

| Concern | Supabase Auth | FastAPI-owned Auth |
|---|---|---|
| Password handling | Supabase | FastAPI / Argon2id |
| Sessions and JWTs | Supabase | FastAPI |
| Email verification | Supabase | FastAPI + the email provider adapter |
| Password reset | Supabase | FastAPI + the email provider adapter |
| FastAPI responsibility | Validate the token, authorize the resources | Own the complete identity lifecycle |
| Security scope | Smaller initial scope | Larger implementation and audit scope |
| Migration cost | Lower if already configured | Higher if switching later |
| Staging isolation | A separate Auth project or configuration | Separate user tables and configuration |

**The honest reading of the trade-off:** Supabase Auth is less code and less risk *if you are
already configured with it*, and FastAPI-owned auth is more code and more responsibility. The
question is not which is better in the abstract — it is which one this repository can carry
without weakening the two things it is built to protect.

---

## 2. Why FastAPI-owned wins here

**1. The frontend is already built for it.** `frontend/src/lib/api/client.ts` has a
`TokenProvider` seam whose comment reads *"Phase B wires this to the auth store; today it is a
no-op"*, and the client already sends `Authorization: Bearer <token>`. The auth surface is four
endpoints — `GET /auth/session`, `POST /auth/sign-in`, `POST /auth/sign-up`,
`POST /auth/sign-out` — over the single `apiClient`, with a typed contract in
`lib/schemas/auth.ts`. FastAPI-owned auth is a **1:1 replacement of a contract that already
exists**; Supabase Auth would replace it.

**2. It preserves the one-HTTP-path rule.** ADR‑A1 exists because two data paths drift. Supabase
Auth would add `supabase-js` to the browser bundle, a second token store, a second refresh path,
and authentication logic outside the Zod-validated boundary — the response validation that makes a
frontend/backend mismatch fail loudly instead of rendering `undefined`.

**3. The offline-replay stage requires it.** The brief's provider stages start with *"offline
replay: fake provider responses from fixtures; no network calls and no secrets"*, and the demo
mode is a product requirement, not a convenience: the capability strip, the prototype banner and
the "Continue as the demo student" path all depend on the mock working. A hosted auth provider is
a network dependency the mock cannot fake without reimplementing its semantics — so either the
demo breaks, or authentication grows a second, divergent mock.

**4. RLS was never the control.** The brief requires *"tenant/user ownership checks on every
profile, document, mission, run, draft and alert"*. That is an application-layer check, and it
lives in the same place either way: the backend holds the service-role key, so RLS is bypassed
regardless of who issues the token. Choosing Supabase Auth would not move the ownership check
into the database.

**5. The email adapter is needed anyway.** The notification contract already requires an email
provider adapter for verification and password reset. The moment that adapter exists, the
difference between "Supabase sends the verification mail" and "we send it" is configuration
rather than capability.

---

## 3. What the choice costs, and how it is covered

Supabase Auth would have given us password hashing, session management, email verification,
password reset and MFA. The FastAPI-owned implementation therefore has to provide all five, to
the same bar, or the decision is not honest:

| Capability | How it is covered |
|---|---|
| Password hashing | `argon2-cffi`, RFC 9106 parameters and the OWASP baseline (m = 64 MiB, t = 3, p = 4) |
| Sessions | Short-lived access JWT (15 min) plus a rotating, single-use refresh token (30 days) stored **hashed**, with reuse detection that revokes the whole token family |
| Token storage | The refresh token in an `HttpOnly; Secure; SameSite=Lax` cookie; the access token in memory only, never in `localStorage` |
| Email verification | A verification record with an expiry, delivered through the email adapter; `emailVerified` and `emailVerifiedAt` on the user row |
| Password reset | A single-use, expiring token through the same adapter, with uniform responses so the endpoint cannot be used to enumerate accounts |
| MFA | TOTP, reserved in the contract and the schema |
| Abuse | Per-route rate limiting on sign-in, sign-up, verification and reset; uniform error messages |

---

## 4. Migration implications

**Switching later is possible, and it is not free.** The cost of moving to Supabase Auth after
the FastAPI implementation exists:

- The frontend's four auth endpoints stay the same, so **no component, hook or route changes**.
  The swap happens behind `apiClient`.
- The user table changes: the backend's `users` rows become Supabase Auth users, with the
  `emailVerified` and `emailVerifiedAt` columns mapped onto Supabase's `email_confirmed_at`.
- Password hashes do **not** migrate. Argon2id hashes cannot be imported into Supabase, so
  existing students would have to reset their password once. For a first cohort of real
  students, that is a support cost, not a data-loss risk — and it is the main argument for
  deciding *now*, which is why this record exists before any implementation.
- The refresh-token table is dropped, and the token verification moves to Supabase's JWKS.

**The same is true in reverse**, which is the symmetry that made the decision feel close: moving
from Supabase Auth to FastAPI-owned auth later means writing the whole identity lifecycle and
re-issuing every session anyway.

---

## 5. What the chosen system must cover before the first student test

- [ ] sign-up, sign-in, sign-out;
- [ ] email verification, with an expiry and a single-use token;
- [ ] password reset, with an expiry and a single-use token;
- [ ] session expiry, and the client's behaviour when it happens;
- [ ] return-to-destination after sign-in (`?next=`), which the frontend already implements;
- [ ] user ownership and authorization on every resource;
- [ ] staging and production separation: separate user tables, separate secrets, no shared
      sessions between environments;
- [ ] the audit log: every sign-in, verification, consent change, fact confirmation, proposal
      acceptance and external-action approval;
- [ ] no secret in the frontend bundle, and no provider key in a log line.

**Not both.** Building the Supabase path "as well, just in case" would double the attack surface
and leave two sources of truth for who a user is — which is exactly the failure mode the Phase B
brief warns about when it says *"No authentication system should be partially implemented twice."*
