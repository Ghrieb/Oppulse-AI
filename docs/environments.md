# Environments, boundaries and secrets

Three environments, three data boundaries, one codebase. The point of this
document is that nothing is ambiguous about which data an environment may
touch and which secrets live where.

---

## 1. The three environments

| Environment | Purpose | Data | Frontend mode | API origin |
|---|---|---|---|---|
| **Local** | Development and the deterministic test suite | Synthetic fixtures, or a local SQLite file | `VITE_API_MODE=mock` | `http://localhost:8000` |
| **Staging** | Integration, the contract check, the AI evaluation | Synthetic data, or a real student's documents with **explicit written consent** | `VITE_API_MODE=live` | `https://oppulse-staging.<region>.azurewebsites.net` |
| **Production** | Real students and real applications | Private, user-owned data with RLS and a retention policy | `VITE_API_MODE=live` | `https://oppulse.<region>.azurewebsites.net` |

**A staging API must never reach production data, and a production API must
never be pointed at a staging database.** The check is in the
configuration, not in a convention: the database URL, the Supabase project
and the CORS allowlist are all environment-specific, and the environment
name is recorded in every log line and every response's request id.

---

## 2. What the browser may know

The browser bundle gets **three** values, and nothing else:

```text
VITE_API_MODE=mock | live
VITE_API_BASE_URL=https://<environment-api-origin>
VITE_SHOW_PROTOTYPE_BANNER=true | false
```

`VITE_API_BASE_URL` is the origin only. The versioned prefix (`/api/v1`) is
added by the service, so the two can never disagree about it.

Everything else — model keys, search keys, storage keys, email keys, the
service-role key, the signing secret — is **server-side only**. A secret in
`VITE_`-prefixed variables is a secret in the bundle, and the bundle is
public. The CI job greps the built assets for the known secret names, and
fails if one appears.

---

## 3. The server-side secrets

| Variable | What it is | Where it lives |
|---|---|---|
| `OPPULSE_DATABASE_URL` | The database connection | App Service application settings |
| `OPPULSE_JWT_SECRET` | The access-token signing key | App Service application settings, or Key Vault |
| `OPPULSE_MODEL_PROVIDER_KEY` | The AI provider key | Key Vault, referenced by the app |
| `OPPULSE_SEARCH_PROVIDER_KEY` | The search provider key | Key Vault |
| `OPPULSE_EMAIL_PROVIDER_KEY` | The mail provider key | Key Vault |
| `OPPULSE_EMAIL_PROVIDER_URL` | The configured mail provider HTTP endpoint | App Service application settings |
| `OPPULSE_EMAIL_FROM_ADDRESS` | The verified sender address | App Service application settings |
| `OPPULSE_SUPABASE_URL` | The project URL | App Service application settings |
| `OPPULSE_SUPABASE_SERVICE_ROLE_KEY` | The service-role key | Key Vault — never in a repository, never in a log line |

The service-role key bypasses the row-level security policies, so it is
the most dangerous secret in the system: it belongs in Key Vault, and the
only code that reads it is the database layer.

---

## 4. The secret-isolation checklist

Run through this before the first student touches staging.

- [ ] No secret is in the repository, in a workflow file, or in a `.env` that
      is not ignored.
- [ ] The built frontend bundle contains no key, no secret name and no
      connection string.
- [ ] The CI workflow uses OIDC (a short-lived, federated identity), not a
      long-lived publish profile or cloud key.
- [ ] The App Service reads its configuration from application settings, and
      the values are marked as secret where they are secret.
- [ ] The logs contain identifiers, event types, timings, routes and stable
      error codes — and never a CV, an extracted document, a prompt, a token
      or a private signed URL.
- [ ] The database and the storage bucket are private; access is through the
      service, with short-lived signed URLs.
- [ ] The staging and production projects are separate: separate Supabase
      projects, separate storage buckets, separate secrets.
- [ ] A preview deployment carries no production URL and no production key.

---

## 5. The staging/production data-boundary checklist

- [ ] The staging database is seeded with synthetic data only.
- [ ] A real document reaches staging only after a written consent, and the
      consent is recorded in the audit log.
- [ ] A document uploaded in staging is deleted when the test is over.
- [ ] The staging storage bucket is not shared with production, and a
      production URL is never pasted into a staging configuration.
- [ ] The capability strip in staging says `mocked` for every provider whose
      smoke test has not passed, whatever the code says.
- [ ] A student in staging cannot reach a production record, and the
      ownership check is tested rather than assumed.

---

## 6. The two honest modes

**Demo mode** is deterministic and visibly synthetic: the prototype banner
is on, the capability strip says what is simulated, and the mock backend
answers from fixtures. It is the mode a committee sees.

**Student Testing mode** replaces the generic banner with the per-capability
status: `live`, `simulated` or `unavailable`, per service. A capability is
`live` only when its provider is configured *and* its smoke test has
passed. A successful API connection alone never flips anything.

The mode is explicit in the environment configuration and visible in
Settings. It is not a cosmetic switch: the two modes use different data
boundaries, and the difference is enforced by which database and which
storage bucket the service is pointed at.
