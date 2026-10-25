# The Azure runbook

**Nothing here has been provisioned.** This is the sequence to run when the
resource list and the environment boundary are approved, in the order the
brief sets out. Every step says what "done" looks like, and every step
records a deployment or request id, so the run can be audited afterwards.

> The brief's rule: *"No Azure resource, Groq key or production data should
> be used until the resource list and environment boundary are explicitly
> approved."* Stop at the first step until that approval exists.

---

## Before you start

| You need | Why |
|---|---|
| An Azure for Students subscription | The resource group lives here |
| A GitHub repository with this code pushed | Static Web Apps deploys from it |
| A Supabase project (staging) | The database and private storage |
| A model-provider key | The AI capability |
| A decision on region and resource-group names | Recorded below, not assumed |

Record the decisions as you make them:

```text
Subscription:      ____________________
Resource group:    ____________________
Region:            ____________________   (e.g. Sweden Central)
Staging API:       ____________________
Production API:    ____________________
Static Web App:    ____________________
```

---

## The order

```text
subscription decision
→ resource group and region approval
→ Static Web Apps setup
→ App Service setup
→ HTTPS and CORS
→ secret configuration
→ Supabase staging connection
→ API health/readiness
→ capability check
→ AI provider smoke test
→ student journey smoke test
```

**Stop at the first failure.** A later step that passes does not make an
earlier one pass.

---

## 1 · The subscription and the resource group

```bash
az login
az account set --subscription "<subscription>"
az group create --name "<resource-group>" --location "<region>"
az group show --name "<resource-group>" --output json
```

**Done when:** the group exists in the intended subscription and region, and
the names are written down above.

## 2 · Static Web Apps

The frontend is deployed from the repository. The preview deployments must
**not** receive production URLs or production keys.

```bash
az staticwebapp create \
  --name "<static-web-app>" \
  --resource-group "<resource-group>" \
  --location "<region>" \
  --runtime "Node:22" \
  --app-location "westeurope" \
  --sku "Free"
```

Then, in the Static Web App's **Build configuration**:

| Setting | Value |
|---|---|
| App location | `frontend` |
| Output location | `dist` |
| Build command | `npm ci && npm run build` |
| API location | `/api/v1` |

The API location makes the static app proxy `/api/v1` to the App Service on
the same origin, which removes the cross-origin problem for the browser
entirely.

**Done when:** a push produces a deployment, and the preview deployment's
configuration contains no production value.

## 3 · App Service (the API)

```bash
az webapp create \
  --name "<api-app>" \
  --resource-group "<resource-group>" \
  --plan "<plan>" \
  --runtime "PYTHON|3.13" \
  --sku "B1"
```

In the **Configuration**:

| Setting | Value |
|---|---|
| Startup command | `./scripts/start.sh` |
| Health check path | `/health` |
| `OPPULSE_ENVIRONMENT` | `staging` |
| `OPPULSE_API_PREFIX` | `/api/v1` |

**Done when:** the health endpoint answers over HTTPS and the startup
command is visible in the logs.

## 4 · HTTPS and CORS

```bash
az webapp config set --name "<api-app>" --always-on true
```

Set the exact origins — never a wildcard, and never a wildcard with
credentials:

```bash
OPPULSE_CORS_ORIGINS='["https://<static-web-app>.azurestaticapps.net"]'
```

**Done when:** `https://<api-app>` answers, the HTTP origin redirects, and
a request from an unlisted origin is refused.

## 5 · The secrets

Store them as application settings, marking the secret ones as secret, or
reference Key Vault. The service-role key, the signing secret and the
provider keys never appear in a repository or a workflow file.

```bash
az webapp config set --name "<api-app> --settings \
  OPPULSE_DATABASE_URL="<postgres url>" \
  OPPULSE_JWT_SECRET="<32+ random bytes>" \
  OPPULSE_MODEL_PROVIDER_KEY="<key>"
```

**Done when:** the service starts with the settings in place, runs
`alembic upgrade head` before serving traffic, and no secret is in the
repository.

## 6 · Supabase, staging

- A **separate** project for staging, with its own database, its own
  storage bucket and its own service-role key.
- The bucket is private; access is through short-lived signed URLs.
- The staging database is seeded with synthetic data only.

**Done when:** the service connects, the ownership check is exercised, and a
record from one account is invisible to another.

## 7 · Health and readiness

```bash
curl -sS "https://<api-app>/health" | jq
curl -sS "https://<api-app>/health/ready" | jq
```

**Done when:** `/health` says `{"status":"ok"}` and nothing else, and
`/health/ready` reports the database as ready.

## 8 · The capability check

```bash
curl -sS "https://<api-app>/api/v1/capabilities" | jq '.capabilities'
```

**Done when:** every capability is `live`, `mocked` or `unavailable`, and
nothing is `live` whose provider has not been tested.

## 9 · The AI provider smoke test

One synthetic, non-personal fixture through the configured provider:
measure the latency, check the schema, check the refusal behaviour, and
check the quota accounting.

**Done when:** the response parses against the schema, the refusal path
behaves, and the cost is recorded. Only then may the capability flip to
`live` — and the flip is a configuration change, never a code change.

## 10 · The student journey smoke test

The real journey, in staging, against the deployed frontend: sign in, run
the agent, read a finding, prepare a document, and see an alert.

**Done when:** the whole journey passes with no console errors, and the
capability strip says exactly what is live.

---

## After the run

Record, for every step: the pass/fail, the deployment or request id, and
the timestamp. That record is what proves the environment was ready before
the first student used it — and it is the evidence the brief asks for:
*"Every check must produce a safe pass/fail result and a request or
deployment ID. A green Azure deployment is not evidence that AI reasoning
is correct."*
