For your constraints, I recommend a zero-cash, API-first architecture using Azure for Students, Groq, Tavily, Supabase and GitHub Actions. You do not need to train an AI model, rent GPUs or buy a subscription to build the first working version.

The important trade-off is that free services impose quotas, cold starts or scheduling limitations. We can build a functional hackathon deployment, but we must design around those limitations rather than pretend it has unlimited resources.

# 1. Recommended technology stack

## Frontend and UI

Free

React + Vite + TypeScript

Tailwind CSS, shadcn/ui, Tiptap editor, React Hook Form, Zod and TanStack Query.

Deploy the static frontend to Azure Static Web Apps Free. This covers the conversational onboarding, dynamic opportunity cards, evidence panel, application workspace and editing canvas.

## Backend and API

Free tier

Python + FastAPI + Pydantic

Host on Azure App Service Linux F1 Free, if available on your subscription. Its published limits include 60 CPU minutes/day and 1 GB storage, with no production SLA. Keep long-running work bounded and store all durable state in the database.

[Azure App Service pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/?utm_source=chatgpt.com) · [FastAPI deployment guide](https://learn.microsoft.com/en-us/azure/app-service/quickstart-python?utm_source=chatgpt.com)

## AI model API

Primary recommendation

Groq API — Free tier

Use a currently available, tool-calling model such as `openai/gpt-oss-120b` or `openai/gpt-oss-20b`, subject to the account's model availability.

The model interprets missions, chooses tools, extracts requirements, evaluates evidence and drafts application documents. Groq publishes model-specific free-tier rate limits, so the agent must handle throttling and retries.

[Models and rate limits](https://console.groq.com/docs/rate-limits?utm_source=chatgpt.com) · [Data privacy controls](https://console.groq.com/docs/your-data?utm_source=chatgpt.com)

## Web search and extraction

Free quota

Tavily API

Search the web and extract content from relevant pages. Add `httpx` and Beautiful Soup for supported direct retrieval and HTML cleanup.

Tavily currently lists 1,000 API credits per month on its free plan, without requiring a credit card. Cache retrieved pages and search results; otherwise repeated agent runs can exhaust the quota.

[Official pricing](https://www.tavily.com/pricing?utm_source=chatgpt.com)

## Authentication, database and files

Free tier

Supabase — PostgreSQL, Auth and private Storage

Store profiles, uploaded document metadata, missions, opportunities, evidence, drafts, alerts and execution history. Use database row-level security and private buckets for user files.

The free plan includes a 500 MB database, 1 GB file storage and 50,000 monthly active users. Free projects can pause after a week of inactivity, and they are not a substitute for production backups.

[Supabase pricing](https://supabase.com/pricing?utm_source=chatgpt.com)

## Scheduling and automation

Free quota

GitHub Actions

Run recurring source checks, background monitoring scripts and CI tests. GitHub Free currently includes 2,000 monthly minutes for standard runners on private repositories; standard runners are free for public repositories.

Scheduled workflows may be delayed or dropped under high load, so this is suitable for a demonstrable prototype, not a guarantee of real-time monitoring.

[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions?utm_source=chatgpt.com) · [Scheduling limitations](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows?utm_source=chatgpt.com)

## 2. Which AI models and APIs should we actually integrate?

Do not integrate five model providers just because they offer free quotas. Start with one main model, one web-search service and an internal interface that allows us to switch providers if necessary.

| Need                    | Recommended component                               | Purpose                                                                      |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Main reasoning          | Groq API with a supported tool-calling model        | Mission planning, eligibility analysis, document interpretation and drafting |
| Real-time web research  | Tavily Search API                                   | Discover opportunities and find relevant source pages                        |
| Page/document retrieval | Tavily extraction + `httpx`                         | Obtain source content for verification                                       |
| PDF processing          | PyMuPDF (`fitz`) and `python-docx`                  | Extract text from PDFs and Word documents locally                            |
| Structured model output | Pydantic schemas                                    | Validate AI output before saving or displaying it                            |
| Matching and ranking    | Python rules plus model-supported semantic analysis | Apply mandatory constraints and explain the relative fit                     |
| Embeddings              | Defer initially                                     | Use metadata, PostgreSQL full-text search and a small candidate set first    |
| Notifications           | Email provider + in-app alerts                    | Deliver real notifications without a paid email service                      |

Groq's published free limits currently include 1,000 requests per day and 8,000 tokens per minute for certain listed models; the exact limits are account- and model-dependent. Its documentation states that inference data is not retained by default, although reliability or abuse monitoring can lead to temporary retention of up to 30 days. A Zero Data Retention option is available through its data controls. [Groq rate limits](https://console.groq.com/docs/rate-limits?utm_source=chatgpt.com) · [Groq data handling](https://console.groq.com/docs/your-data?utm_source=chatgpt.com).

### What about Gemini API?

Google's Gemini API also has a free tier. However, its pricing documentation says that content used on the free tier can be used to improve Google's products. That makes it a less attractive default for sending unredacted CVs, transcripts and private recommendation materials. [Gemini API pricing and data terms](https://ai.google.dev/gemini-api/docs/pricing?utm_source=chatgpt.com).

For our product, I would extract documents locally, remove unnecessary personally identifying details before making model calls, request user consent for external processing, and enable Groq's available data-retention controls. We should never put passports, identity documents or full private documents into debug logs.

One additional point: do not build around GitHub Models as an AI API. GitHub announced its full retirement for July 30, 2026, so it is no longer a viable provider for this project. [Official retirement announcement](https://github.blog/changelog/2026-07-01-github-models-is-being-fully-retired-on-july-30-2026/?utm_source=chatgpt.com).

# 3. How should the agent be implemented?

You do not need a large multi-agent framework or a GPU. A single orchestrator with carefully defined tools is enough for the first release.

```
User's mission
     |
     v
FastAPI backend
     |
     v
AI orchestrator (Groq)
     |
     +--> Search web (Tavily)
     |
     +--> Retrieve and parse pages / PDFs
     |
     +--> Extract structured requirements
     |
     +--> Compare requirements with confirmed profile
     |
     +--> Calculate deadlines and funding gaps
     |
     +--> Verify evidence and save results
     |
     +--> Generate application drafts
     |
     v
PostgreSQL --> UI, task list and alerts
```

Use a bounded tool-calling loop in Python to begin with. Set a maximum number of tool calls per run, enforce timeouts, validate every response and store execution progress. LangGraph can be introduced later if its checkpointing and orchestration benefits justify the additional complexity.

A sensible set of backend tools would include:

```
search_web(query, filters)fetch_source(url)extract_pdf(document_id)check_eligibility(profile, requirements)calculate_funding_gap(costs, confirmed_support)save_opportunity(mission_id, opportunity)create_document(opportunity_id, document_type)create_alert(mission_id, event)
```

The model chooses which tools to call, but normal code controls authentication, permissions, calculations, persistence and notifications. Every claim shown in the results page must be traceable to evidence; unknown information must remain unknown.

# 4. Private documents, security and LinkedIn

There are two areas where the free-tier architecture needs particular care.

CVs and transcripts. Use private file storage, signed URLs, ownership checks, row-level security and server-side secrets. PDF and DOCX processing should be isolated and reject unsupported or oversized files. We should not store the full CV in a model prompt log or expose API keys in browser JavaScript.

LinkedIn. Do not make unrestricted LinkedIn access a dependency of the MVP. Sign-in does not grant universal permission to read the user's posts and feed. Post access can require restricted API permissions, and unauthorized scraping is prohibited. Support pasted post text, user-provided links that can lawfully be retrieved, and other official sources first. [LinkedIn Posts API permissions](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?utm_source=chatgpt.com).

# 5. Azure for Students: how to use it safely

Microsoft's Azure for Students offer currently includes $100 in Azure credits for one year, without requiring a credit card, subject to eligibility. The offer can be renewed annually while the student remains eligible. Those credits are finite: they are not equivalent to an unlimited free plan, and resources can be disabled when the credit is exhausted unless the subscription is upgraded. [Azure for Students](https://learn.microsoft.com/en-us/azure/education-hub/about-azure-for-students?utm_source=chatgpt.com).

My recommendation is:

- Use Azure's genuinely free service tiers for hosting where they meet the product's needs.
- Use Groq and Tavily for the primary AI and web-search services rather than assuming Azure AI model endpoints are free.
- Treat the $100 student credit as an optional fallback for a specific deployment need—not as the project's operating budget.
- Set Azure cost alerts and never upgrade to a paid subscription or add billing details just to keep a feature running.

# 6. Will the entire product cost $0?

## Target recurring cash cost

Prototype and hackathon demonstration

# $0/month

Possible under free tiers, provided usage stays within quotas and we do not enable paid services or exceed free allocations.

This is a target, not a guarantee of uninterrupted service. Quotas can change, free services may pause, and model or search APIs can become temporarily unavailable.

## 7. The exact development stack I would commit to

For the submission, keep it to this:

- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui.
- Writing canvas: Tiptap.
- Backend: FastAPI + Pydantic.
- Database and authentication: Supabase PostgreSQL, Auth and private Storage.
- AI model: Groq API using one supported tool-calling model.
- Search: Tavily API.
- Documents: PyMuPDF + `python-docx`.
- Notifications: Email provider and in-app alerts.
- Background monitoring: GitHub Actions scheduled workflow.
- Deployment: Azure Static Web Apps Free for the frontend and Azure App Service Linux F1 Free for the Python backend, subject to availability on your subscription.
- Testing: Pytest, Playwright and GitHub Actions CI.
- Repository: a clear `frontend/`, `backend/`, `workers/`, `tests/` and `docs/` structure with all secrets in deployment settings.

For the first complete vertical slice, prove that a judge can upload a CV, create a mission, run actual web research, view a source-backed opportunity analysis, edit and save an application draft, and receive a real alert from a controlled monitoring test.

That scope demonstrates the core AI, working product, integrations and background automation without relying on any paid plan. It is a much stronger use of the zero-budget constraint than attempting to build an unlimited general-purpose browser agent.


For your Opportunity Action Agent, choose Always free first. Use the “12 months free” services only when you specifically need their additional capacity.

These are two categories of free Azure services included in the Azure for Students offer—not two separate student programs. [Microsoft's official comparison](https://azure.microsoft.com/en-us/free/students?utm_source=chatgpt.com).&#x20;

[image](https://www.google.com/s2/favicons?domain=https://azure.microsoft.com\&sz=32)

Microsoft Azure



## What's the difference?

| Feature               | Always free                           | 12 months free                                                                                 |
| --------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Cost                  | $0 within the published quota         | $0 within the published quota during the qualifying 12 months                                  |
| After the free period | Remains free within its quota         | The free allowance expires                                                                     |
| Best for              | Core services you want to keep using  | Temporary development or extra capacity                                                        |
| Risk                  | Quotas and service limits still apply | Your resources may be disabled or require a paid upgrade when the student subscription expires |
| My recommendation     | Use first                             | Use selectively                                                                                |

Azure for Students separately provides $100 in credits for 12 months, renewable annually while you remain eligible. If you exhaust the credit or it expires without upgrading, Microsoft says your subscription and deployed services can be disabled.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://azure.microsoft.com\&sz=32)

Microsoft Azure

+2



## Which Azure services should you choose?

These are the most relevant options for your project, according to Microsoft's current service listings.

Azure Static Web Apps — Always free

Choose this

Host the React frontend, including your dashboard, agent conversation, opportunity results and writing canvas.

Free allowance: 100 GB bandwidth per subscription and 0.5 GB storage per app.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://azure.microsoft.com\&sz=32)

Microsoft Azure



Azure Functions — Always free

Choose this

Run lightweight API operations, short processing tasks and notification triggers.

Free allowance: 1 million requests. It is not a substitute for a persistent, long-running agent worker.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://azure.microsoft.com\&sz=32)

Microsoft Azure



Azure SQL Database — Always free

Consider this

Store profiles, missions, opportunities, eligibility assessments and alert history.

Free allowance: 100,000 vCore-seconds of serverless usage per month and 32 GB storage.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://azure.microsoft.com\&sz=32)

Microsoft Azure



Azure Database for PostgreSQL — 12 months free

Useful if you specifically want PostgreSQL as your managed database. Its listed allowance includes 750 hours of a Burstable B1MS Flexible Server and 32 GB each for storage and backup.

I would not make your long-term architecture depend on this tier until you have confirmed that your subscription qualifies and planned how to migrate or continue after the allowance expires.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://azure.microsoft.com\&sz=32)

Microsoft Azure



## My final recommendation

For a zero-budget deployment, start with Static Web Apps + Azure Functions + an Always-free database, and use a free-tier external AI API for the agent's reasoning. Keep the AI key and all external API calls server-side.

One caveat: Always free means the listed allowance remains free; it does not make every dependent service free. For example, Azure Kubernetes Service has a free control plane, but its compute nodes still incur charges. Verify each resource's pricing before deploying it.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://azure.microsoft.com\&sz=32)

Microsoft Azure
