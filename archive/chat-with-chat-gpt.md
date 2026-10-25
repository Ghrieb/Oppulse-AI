# Opportunity Action Agent — refined product blueprint

I think we now have a coherent product direction. The goal is not to build another education website, a chatbot, or an autonomous browser demo. It is to build a personal AI opportunity agent that continuously works toward the user's goals and helps them take action when it finds something valuable.

The product has two operating modes:

## 1. Find Now

Immediate, testable value

The user uploads a CV, adds supporting documents, describes their goals and starts a research mission. The agent searches supported web sources, reads calls and PDFs, evaluates opportunities and returns ranked, evidence-backed findings.

## 2. Keep Watching

Persistent agent

The user saves the mission. A background worker periodically checks supported sources for new opportunities or meaningful changes. When a finding satisfies the user's criteria, it sends a notification with the evidence and recommended next action.

The first mode makes the product useful to a judge immediately. The second proves that it is more than a one-shot AI workflow.

## 1. What the user actually experiences

Imagine an Algerian student uploads a CV, transcript and English-language certificate, then gives the agent this mission:

EXAMPLE AGENT MISSION

"Find fully funded international research internships, fellowships and summer schools in computational biology, genetics and AI. Prioritize opportunities accepting Algerian applicants and Master's students. Check whether my profile meets the requirements, identify funding gaps, and alert me when an opportunity is worth pursuing."

The agent should then carry out a connected sequence of operations, not return a generic essay.

01

Understand me

Extract relevant qualifications and preferences from uploaded documents. Ask the user to confirm uncertain facts.

02

Research the web

Search supported sources, open relevant pages, read official announcements and process attached PDFs.

03

Reason about fit

Check nationality, degree, field, language, eligibility restrictions, deadlines and funding conditions.

04

Verify the evidence

Attach source links and relevant excerpts; distinguish facts, inferences and unknowns.

05

Recommend action

Explain why an opportunity is worth pursuing, what could disqualify the applicant and what to prepare next.

06

Act and monitor

Create a task, send an alert and continue monitoring the saved mission according to its schedule.

This is the actual product promise:

The user expresses a goal once. The agent researches, assesses, prioritizes, alerts and helps execute the next step.

And the concept can later expand beyond education. A business could monitor grants and tenders; a researcher could monitor publications and funding calls. We would reuse the agent engine rather than launch three unrelated products.

## 2. The hardest technical question: how do we make it genuinely agentic?

The AI needs tools it can call, persistent memory, an execution loop and a way to verify whether its work succeeded.

The architecture I recommend is:

### User Profile & Mission

CV, documents, goals, preferences, budget

## Agent Orchestrator

Plans tasks, chooses tools, handles failures and tracks progress

Web research

Search, browse supported pages, retrieve PDFs and inspect sources

Document intelligence

Extract qualifications, requirements, dates and funding details

Decision engine

Eligibility rules, personalized ranking and evidence checks

Background worker

Scheduled scans, change detection, retries and alert triggers

### Action & Feedback

Dashboard, notifications, tasks, evidence and execution history

A practical stack would be Next.js + Python/FastAPI + PostgreSQL + a persistent background worker + an LLM with tool calling + a web-search and extraction service.

One important design choice: the language model should not improvise every operation. Use regular application code for scheduling, database writes, duplicate detection, permissions and deterministic eligibility checks. Let the AI handle the interpretation, research planning, ambiguous requirements and explanations.

That combination is more reliable, less expensive and easier for a judge to inspect than a single unconstrained autonomous loop.

## 3. Can it actually browse websites, read PDFs and LinkedIn posts?

Yes, with defined access boundaries.

- Official websites and calls: Use search and web extraction tools to discover relevant pages, retrieve content and follow links. Tools such as [Firecrawl](https://www.firecrawl.dev/?utm_source=chatgpt.com) provide search, scraping, browser interaction and extraction capabilities designed for AI applications.
- PDFs and uploaded CVs: Process text-based PDFs directly and use a fallback for supported scanned documents. Extract information into structured fields that can be checked and reused.
- LinkedIn: This requires special care. LinkedIn expressly prohibits unauthorized crawlers, bots, browser extensions and automated scraping of its services. We should not build a logged-in LinkedIn scraping bot. Instead, the product can accept user-provided post text or links, work with content legitimately accessible through permitted interfaces, and support authorized integrations if available. See [LinkedIn's official scraping policy](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibition-of-scraping-software?intendedLocale=en\&lang=en-us\&utm_source=chatgpt.com).
- Other sources: Keep a modular connector system so new sources can be added without redesigning the agent.

The agent should also treat content retrieved from websites and documents as untrusted input. A webpage must not be allowed to instruct the agent to reveal a user's CV, expose API keys or execute unauthorized actions.

For personal documents, the application must provide clear consent, access controls and deletion. Applications and outgoing messages should require user approval before being submitted or sent.

## 4. How we guarantee an impressive, testable demo

The demonstration must not depend on a new scholarship appearing during the presentation.

Use a real, on-demand research run and an explicitly labeled controlled monitoring test.

Demo A — Real research

Upload a CV, define a mission and click Run Agent. The app researches a curated set of current opportunities and produces evidence-backed recommendations.

Demo B — Prove the reasoning

Change a test profile or a controlled sample announcement. Run the agent again and show how a changed eligibility condition alters the assessment.

Demo C — Prove autonomy

Create a test-source change, trigger the monitoring worker and show the new event in the history and a real notification channel. Label the test clearly.

This is how we demonstrate the full lifecycle during a three-minute pitch. The live research demonstrates immediate value; the controlled event proves background execution; the source citations demonstrate that the results are grounded in evidence.

A real-world alert can only be as timely as the source access and check frequency allow. During development, we can demonstrate immediate detection against a controlled source without falsely claiming that every external website is monitored in real time.

## 5. What we can afford

The prototype does not require training a model from scratch or renting GPUs.

Firecrawl currently offers 1,000 monthly free credits without requiring a credit card; a basic page scrape generally costs one credit. Its published paid Hobby tier starts at $19/month. [Official Firecrawl pricing](https://www.firecrawl.dev/pricing?utm_source=chatgpt.com).

For inference, Groq currently lists GPT OSS 20B at $0.075 per million input tokens and $0.30 per million output tokens, with tool-use and structured-output capabilities. [Official model documentation](https://console.groq.com/docs/models?utm_source=chatgpt.com).

An illustrative workload of 100,000 input tokens and 20,000 output tokens would cost approximately $0.0135 in model inference at those rates. Web extraction, repeated research calls and other services are separate expenses.

The practical budget target should be:

| Component                   | Prototype target                                                     |
| --------------------------- | -------------------------------------------------------------------- |
| Web research and extraction | $0 within the initial free allocation                                |
| AI inference                | Low-volume, usage-based                                              |
| Database and file storage   | Free tier initially                                                  |
| Persistent scheduled worker | From $1/month for a Render cron service, depending on usage and plan |
| Domain                      | Optional                                                             |
| Initial target              | $0–10/month, contingent on free-tier access and controlled usage     |

Render documents a $1 monthly minimum for a cron-job service; its compute usage is billed separately according to the selected plan. [Render cron-job documentation](https://render.com/docs/cronjobs?utm_source=chatgpt.com).

These figures are infrastructure targets, not a guarantee that all services will be available free of charge or that the app will remain production-reliable at that budget. We must verify API access, quotas, payment requirements and deployment limits before choosing the final stack.

## 6. How this maps to the five judging criteria

| Criterion             | Our concrete evidence                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Problem and insight   | Interviews with students who have missed, misjudged or spent substantial time evaluating opportunities               |
| Working product       | Upload documents → research → assess → recommend → alert, all functioning end to end                                 |
| Technical execution   | Modular connectors, readable source code, automated tests, secure secrets, error handling and a complete README      |
| Impact and viability  | Measured recommendation quality, feedback from real applicants and a credible plan to maintain sources after October |
| Story, pitch and demo | A live research mission, evidence-backed result and a working notification demonstrated within three minutes         |

I would validate the initial problem with 5–8 students before committing to all of the features. The key questions are whether they currently spend significant time searching, whether they miss relevant opportunities, and whether they would trust an agent's recommendations enough to act on them.

For evaluation, track precision among the agent's top recommendations, correctness of eligibility findings, percentage of claims backed by sources, irrelevant-alert rate and whether users actually complete the recommended next steps.

## 7. The scope I would commit to for October 31

Given the remaining time, I would prioritize a single polished workflow with all its core pieces working:

- User accounts or a secure personal workspace, CV upload and profile extraction.
- A natural-language mission builder.
- Real web search, supported page browsing and PDF analysis.
- An agent that evaluates current opportunities and provides citations, eligibility explanations, funding information and next steps.
- Persistent storage, scheduled monitoring, change detection, an execution log and one real notification channel.
- A deployed interface, an understandable repository and a reproducible test suite.

The key is to support a controlled range of sources well, rather than claim to browse every website on the Internet. Advanced autonomous form filling, automatic applications, unrestricted LinkedIn automation, and many unrelated business verticals should remain outside the first version.

My final recommendation: build the Opportunity Action Agent around one promise: it does the research work you would otherwise do yourself, tells you what is genuinely worth your time, and helps you act before you miss the opportunity.

That combines the intelligence, autonomy, immediate usefulness and demonstrable technical execution needed for a competitive Thirduni submission.


# Technical development blueprint: Opportunity Action Agent

The right way to build this is as a real software product with an AI agent at its core—not an AI demo wrapped in a beautiful UI.

I would use a modular architecture with secure document storage, an agent orchestrator, browser and search tools, a drafting workspace, external API integrations, and a persistent background worker. Most importantly, every major feature must be connected to a working backend and testable by a judge.

There is one important constraint: we have approximately 13 days until the October 31 deadline. We should design for the full vision, but implement a complete, deployable slice of it rather than a large collection of incomplete features.

## 1. The technology architecture I recommend

## Frontend — Next.js + TypeScript

Responsive dashboard · Agent chat · Research results · Editable drafting workspace

## Backend API — Python + FastAPI

Authentication · Permissions · Document processing · Business logic · Integrations

### Agent orchestration and tools

Research tools

Web search, browser retrieval, PDFs and source citations

AI reasoning

Planning, extraction, eligibility, comparison and recommendations

Drafting tools

Create, edit, revise and save application documents

Automation tools

Scheduled jobs, change detection and notifications

PostgreSQL

Profiles, missions, results, drafts and execution history

Private file storage

CVs, transcripts, certificates and saved documents

### Persistent background worker

Runs research jobs, retries failures, monitors saved missions and sends notifications when relevant events are found.

### Why this stack?

| Layer                                | Recommended technology                                                 | Reason                                                                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI and UX                            | Next.js, TypeScript, Tailwind CSS, accessible component library        | Responsive application, reusable UI and fast deployment. [Next.js documentation](https://nextjs.org/docs/app?utm_source=chatgpt.com)                                                                                                      |
| Backend                              | Python, FastAPI, Pydantic                                              | Python has a mature ecosystem for AI, document processing and data validation.                                                                                                                                                            |
| Authentication, database and storage | Supabase Auth, PostgreSQL and private Supabase Storage                 | One integrated service for identity, relational data and files.                                                                                                                                                                           |
| Agent                                | A controlled tool-calling workflow, optionally LangGraph               | Supports multi-step execution and recovery; persistence and checkpoints are useful for resumable agents. [LangGraph persistence](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/persistence.mdx?utm_source=chatgpt.com) |
| AI models                            | Provider abstraction for OpenAI, Groq or another supported API         | Different tasks can use appropriate models without tightly coupling the product to one provider.                                                                                                                                          |
| Web access                           | Search API plus a compliant page-fetching/extraction service           | Provides current source material to the agent.                                                                                                                                                                                            |
| Scheduling                           | Dedicated background worker and scheduled jobs                         | Supports recurring monitoring independently of the user's browser session.                                                                                                                                                                |
| Testing                              | Pytest, API integration tests, frontend component tests and Playwright | Checks individual components and the entire user journey.                                                                                                                                                                                 |

I would use OpenAI's current Responses API or an equivalent tool-calling API for model interaction, where appropriate. The Responses API supports web search, file search and function calling, which are useful building blocks for research agents. These tools do not replace our own authorization, database logic, error handling or security controls. [Official API documentation](https://developers.openai.com/api/docs/guides/tools?utm_source=chatgpt.com).

One architectural rule: a model provider should be replaceable through a small internal interface. Avoid building the entire application around one provider's proprietary agent abstractions.

## 2. UI and UX: what the judge actually sees

I would build a focused workspace rather than a conventional chatbot interface.

## Opportunity Agent

Your research and application workspace

Ready

Main navigation

Missions

Goals and agent runs

My documents

CV and certificates

Discoveries

Ranked findings and alerts

Writing studio

Letters and application drafts

EXAMPLE MISSION

## Find fully funded research internships in Europe

Computational biology

Master's students

Funding required

Last run: Today

Completed

Research completed

12 sources reviewed · 4 candidate opportunities identified · 2 requiring further eligibility verification

Illustrative interface data, not results from an actual agent run.

The essential UX principle is to make the agent's status explicit. Users should know whether it is queued, running, waiting for information, completed or failed.

### The five screens to implement first

1\. Onboarding and profile. The user can sign up, connect permitted accounts, upload their CV and certificates, and confirm extracted information. The agent must not silently assume that ambiguous qualifications, dates or language scores are correct.

2\. Mission builder. The user describes a goal in natural language and edits the resulting monitoring criteria before starting the mission. The app displays which sources the agent can access and how often recurring checks will run.

3\. Research workspace. Show progress, retrieved sources, important findings and the next action. Display actual execution events instead of invented reasoning or fake tool activity.

4\. Opportunity detail. Show eligibility, funding, deadlines, source citations, unknown conditions and a clear recommendation. Let the user correct profile details and rerun the assessment.

5\. Writing studio. Open an opportunity alongside a document editor, with the agent available to revise selected text or the whole draft.

These flows should be usable from a laptop and mobile browser, with loading states, empty states, error recovery and keyboard-accessible controls.

## 3. The writing studio: an editable canvas with an AI agent

This feature is particularly worth implementing because it makes the AI useful beyond finding information.

I would use a rich-text editor such as [Tiptap](https://tiptap.dev/?utm_source=chatgpt.com) rather than trying to build text editing from scratch.

## Motivation Letter

Draft v3

Document editor

Editable text, selection, undo and autosave

Dear Selection Committee,

I am applying for this research opportunity because it aligns with my academic background and my interest in computational approaches to biological research...

Illustrative draft excerpt.

Ask the writing agent

Make this paragraph more specific to the host laboratory. Preserve my own experience and do not invent achievements.

Selection: Paragraph 2

Rewrite selected text

Review changes

Version history

Export

The editor needs a real interaction loop:

1. The user selects a paragraph or opens the full document.
2. They request a revision, such as making it shorter, adapting it to an opportunity or improving clarity.
3. The backend sends the selected text and relevant authorized context to the model.
4. The model returns a proposed revision.
5. The interface displays a diff and allows the user to accept, reject or edit the result.
6. The accepted draft is saved, versioned and exportable.

The AI must not overwrite the user's document automatically. Autosave, undo, revision history and recoverable drafts are core functionality, not optional polish.

For recommendation letters, the product should help prepare factual information for the recommender and draft material for their review. It must not fabricate an endorsement or impersonate a professor. Motivation letters, research statements, CV revisions and professional emails are simpler initial drafting targets.

## 4. Backend and database design

A working product needs to preserve state. We cannot keep the entire application inside an LLM conversation.

The minimum database structure should contain these entities:

| Table           | Purpose                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| `profiles`      | User preferences, qualifications, goals and confirmed facts                    |
| `documents`     | Metadata, private storage path, processing status and extracted information    |
| `missions`      | User objectives, filters, supported sources and monitoring schedules           |
| `agent_runs`    | Run status, timestamps, progress, failures and execution metadata              |
| `opportunities` | Normalized opportunity information and current status                          |
| `evidence`      | Source URLs, excerpts, retrieval timestamps and supporting findings            |
| `matches`       | User-specific fit assessment, eligibility findings and explanations            |
| `drafts`        | Document content, versions, revision history and linked opportunity            |
| `integrations`  | Connected providers, granted permissions and encrypted tokens where applicable |
| `alerts`        | Event details, delivery status, read status and user feedback                  |
| `audit_events`  | Important security and execution events                                        |

Use unique constraints to prevent duplicate opportunities and alerts. Give every user-owned record an explicit owner or tenant identifier. Use transactional updates for operations that modify several related records.

### API structure

I would implement a versioned API with clear boundaries, for example:

```
POST   /api/v1/documents
GET    /api/v1/documents
DELETE /api/v1/documents/{id}

POST   /api/v1/missions
POST   /api/v1/missions/{id}/runs
GET    /api/v1/runs/{id}
GET    /api/v1/runs/{id}/events

GET    /api/v1/opportunities
GET    /api/v1/opportunities/{id}

POST   /api/v1/drafts
PATCH  /api/v1/drafts/{id}
POST   /api/v1/drafts/{id}/revisions

GET    /api/v1/alerts
POST   /api/v1/integrations/{provider}/connect
```

These are proposed endpoints, not implemented routes.

Long-running research should be asynchronous. The frontend submits a mission run, receives a run ID and polls or subscribes to actual status updates. A background worker performs the work and persists its progress, so a browser refresh does not destroy the task.

## 5. Designing the actual agent

The agent needs an orchestration layer that can call explicit tools. I would start with one orchestrated agent and a small set of tools, not a swarm of independent agents.

Its tools could be:

```
search_web(query, filters)
fetch_page(url)
extract_document(document_id)
compare_profile_to_requirements(profile, requirements)
calculate_funding_gap(costs, confirmed_support)
save_finding(mission_id, finding)
create_draft(opportunity_id, document_type)
schedule_next_check(mission_id)
send_notification(alert_id, channel)
```

Each tool requires input validation, authorization and error handling.

The main workflow is:

Plan → Search → Read → Extract → Evaluate → Verify → Save → Notify.

The agent should have a bounded execution budget: a maximum number of search calls, pages, model calls, execution time and output size. If it cannot verify eligibility or funding, it should report uncertainty rather than repeatedly searching or inventing an answer.

### Separate what requires AI from what requires normal code

| Task                                                  | Best implementation                             |
| ----------------------------------------------------- | ----------------------------------------------- |
| Interpret a natural-language mission                  | LLM                                             |
| Extract structured information from complex documents | LLM plus document processing                    |
| Compare nuanced research interests                    | Semantic matching plus LLM                      |
| Check explicit nationality or degree restrictions     | Deterministic rules, with evidence              |
| Calculate funding gaps and dates                      | Normal code                                     |
| Detect duplicate events                               | Database constraints and normalized identifiers |
| Schedule recurring checks                             | Background worker                               |
| Deliver alerts and track failures                     | Notification service and normal code            |
| Explain why a finding is relevant                     | LLM grounded in stored evidence                 |

This separation will make the system cheaper, easier to debug and more defensible in the technical judging.

## 6. LinkedIn integration: an important constraint

We need to distinguish two separate features: connecting a LinkedIn account and reading the user's LinkedIn posts or feed.

LinkedIn's current OpenID Connect integration provides access to basic profile information and email through scopes such as `openid`, `profile` and `email`. It does not grant universal access to a member's posts or entire profile history. [Official LinkedIn documentation](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2?utm_source=chatgpt.com).

Reading member posts through the API requires additional permissions, and the `r_member_social` permission is restricted to approved developers. LinkedIn also prohibits unauthorized scraping and automated access to its website. [Posts API permissions](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-07\&utm_source=chatgpt.com) · [LinkedIn scraping policy](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibition-of-scraping-software?utm_source=chatgpt.com).

Therefore, I would implement the integration in stages:

- First: ordinary application authentication and manual profile/document import.
- If available: LinkedIn sign-in and permitted basic profile import.
- Later, subject to approval: additional authorized LinkedIn data access.
- Fallback: allow users to paste a post, supply a public URL for lawful retrieval, or upload content they are authorized to provide.

The interface must clearly show which LinkedIn capabilities are connected and which are unavailable. It is better to ship an honest, functional connector than promise an integration that depends on API permissions we do not possess.

## 7. Security must be built into the architecture

CVs, transcripts, identity documents and recommendation materials contain personal information. This makes security a fundamental requirement.

The baseline should include:

- Authentication and authorization: enforce ownership checks on every API operation; use row-level security for database access.
- Private file storage: files must not be publicly addressable. Issue short-lived signed URLs only when authorized. Supabase documents both database row-level security and storage access policies. [Database RLS](https://supabase.com/docs/guides/database/postgres/row-level-security?utm_source=chatgpt.com) · [Storage security](https://supabase.com/docs/guides/storage/security/access-control?utm_source=chatgpt.com).
- Secrets: store API keys and OAuth client secrets in environment-based secret management, never in frontend code or Git history.
- OAuth: validate callback state, use appropriate OAuth flows, request minimal scopes and securely store or revoke tokens. [OAuth security guidance](https://developers.google.com/identity/protocols/oauth2/resources/best-practices?utm_source=chatgpt.com).
- Uploaded files: enforce file type and size limits, validate actual file content, isolate document processing and avoid executing active content.
- AI prompt injection: treat webpages and uploaded documents as untrusted evidence, not instructions. Retrieved content must not be able to override system rules or authorize external actions.
- Limited permissions: research agents should have read-only access by default. Sending messages, submitting applications or publishing content must require explicit approval.
- Privacy controls: provide document deletion, retention policies and clear disclosure of which AI provider receives which content.

The security review should cover the risks identified in the [OWASP GenAI Security Project's 2026 LLM Top 10](https://owasp.github.io/www-project-top-10-for-large-language-model-applications/?utm_source=chatgpt.com), particularly prompt injection, sensitive data disclosure and excessive agency.

## 8. Deployment and integration strategy

I would keep deployment simple:

- Frontend on Vercel or another supported frontend host.
- FastAPI backend on a persistent application host.
- PostgreSQL, authentication and private file storage through Supabase.
- An independently deployed background worker for research and scheduled monitoring.
- Model, search and notification APIs configured through server-side secrets.

Do not depend on a frontend deployment alone to run long-lived agent tasks. For example, Vercel's Hobby plan currently limits Cron Jobs to daily execution, with scheduling precision of up to an hour. That is not suitable for a product promise of frequent monitoring. [Vercel Cron documentation](https://vercel.com/docs/cron-jobs/usage-and-pricing?utm_source=chatgpt.com).

The app should degrade gracefully if one provider is unavailable. A failed search should be logged as a failed source, not interpreted as proof that no opportunities exist. Similarly, a failed notification should be retried and retained in the execution history.

## 9. The 13-day development plan

Given the October 31 deadline, I would develop in this order.

| Dates     | Milestone                                                          | Acceptance condition                                                      |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Oct 18–19 | Repository, architecture, UI scaffold, authentication and database | Judge can sign in and reach a protected workspace                         |
| Oct 20–21 | Private document upload and profile extraction                     | Upload a CV, inspect the extracted fields and correct them                |
| Oct 22–24 | Agent research workflow                                            | Run a mission, retrieve real sources and produce grounded findings        |
| Oct 25–26 | Opportunity analysis and drafting studio                           | Compare eligibility and create/edit/save a document                       |
| Oct 27–28 | Persistent jobs and notifications                                  | A completed run survives refresh, and a controlled event creates an alert |
| Oct 29    | Security and integration testing                                   | Ownership, file access, error states and tool permissions tested          |
| Oct 30    | Deployment, README and demo rehearsal                              | Clean-session deployment test passes                                      |
| Oct 31    | Final regression and submission                                    | Core workflow works end to end without developer intervention             |

This plan assumes you already have access to suitable model and search APIs and can make use of managed infrastructure. LinkedIn access approval is not a safe dependency for the submission date.

The first release does not need dozens of integrations. It needs one complete workflow that uses a real CV, a real mission, actual research tools, a verifiable output and a working follow-up action.

## 10. How we earn the 20 points for a working product

Before submission, the team should be able to demonstrate every item below from a clean deployment.

## Working-product acceptance checklist

## 0/15

Account and documents

Sign in and access a protected workspace

Upload a CV and see extracted information

Correct and save profile facts

AI agent

Create a mission in natural language

Run real web research with visible source citations

Receive eligibility and relevance analysis grounded in evidence

Writing studio

Generate a draft from an actual opportunity

Edit it directly and prompt a revision

Review changes, save versions and export the document

Automation

Save a mission for recurring checks

Trigger a controlled source change and detect it

Receive a real notification and inspect its history

Engineering quality

No secrets in the repository

Cross-user access checks and private file storage verified

Automated tests pass and README explains setup and limitations

Copy checklist

The team should not mark features complete because their buttons exist. A feature is complete when it works against the actual backend, handles failure states, persists the expected data and can be reproduced from a clean session.

My strongest recommendation: build the core product around the complete journey upload profile → launch agent → verify findings → draft an application document → save a mission → detect a test event → receive an alert.

That is ambitious but coherent. It demonstrates AI reasoning, real integrations, persistence, editable generation, autonomous execution and security—not just a chatbot—and gives the judges a concrete reason to believe the platform can continue growing after October.



This is the direction I would commit to. The big idea is that the entire platform adapts to the student's goal, and every discovery can turn into a concrete action.

Instead of building five disconnected features, we should connect them into one continuous journey:

Discover → Understand → Verify → Prepare → Apply → Monitor.

## 1. The experience should start with a conversation, not a complicated dashboard

The first screen should feel like meeting a personal agent that is trying to understand what you need. It should ask a question, offer sensible choices, remember the answers and adapt the next question.

## Your Opportunity Agent

Research, opportunities and applications in one workspace

# What should we work on today?

Tell me your goal. We can start from scratch or investigate something you've already found.

Find opportunities suited to me

Analyze a specific opportunity

Help me prepare an application

Monitor an opportunity or website

What are you looking for?

Research internships

Scholarships and fellowships

Summer schools and research programs

Anything relevant to my goals

Where should I search?

Search globally

Prioritize Europe

Prioritize specific countries or regions

What does funding mean to you?

Fully funded only

Include partial funding if it's worthwhile

Show all, but explain the financial gap

Should I use your saved profile and CV?

Yes, use my confirmed profile

No, search using my instructions only

Continue with this mission&#x20;

Interactive concept mockup. This illustrates the proposed onboarding experience; it does not start a live research job.

The important UX decision here is that the agent should not ask every question up front. It asks only what is needed to make progress, lets the student skip optional details, and offers to search globally when the user has no geographic preference.

## 2. Discovery should produce intelligent, polished results

The results page is where the agent must prove its value.

## Opportunities for you

Research mission · Illustrative results

Profile matched

Funding verified

Deadline upcoming

RESEARCH OPPORTUNITY · EUROPE

## Research Internship in Computational Biology

Example institution · Example program

# 88

Fit / 100

Fully funded\*

Eligibility: likely

Competition: unknown

Why the agent recommends it

Your education and research interests appear relevant to the program. The announcement's eligibility criteria still need to be checked against your complete profile.

Deadline

Show the verified date, timezone if applicable, and time remaining.

Funding

Show tuition, stipend, travel, housing and other costs separately, indicating what is confirmed and what is unknown.

Official call

Deep analysis

Track changes

\*Illustrative fields only. A fully funded label should appear only when the relevant coverage is supported by evidence.

&#x20;Not for meAnalyze opportunity&#x20;

Every opportunity should separate five concepts that are frequently confused:

- Fit score: how well it matches the student's verified profile and preferences.
- Eligibility: whether mandatory criteria are satisfied, violated or still uncertain.
- Funding: what the official source actually pays for.
- Competitiveness: how selective the program appears based on available evidence.
- Confidence: how complete and reliable the information behind the assessment is.

An 88/100 fit score must not imply an 88% chance of acceptance. Similarly, the agent must show "competitiveness unknown" when reliable acceptance statistics or other meaningful evidence are unavailable.

The student should be able to dismiss a result, explain why it is irrelevant, save it, compare it with another opportunity, open the official source or ask a follow-up question. These interactions should update persistent preferences and data, not just the current screen.

## 3. Every opportunity needs a deep-analysis page

The Deep analysis action should open a detailed view with an executive summary followed by evidence and actionable next steps.

## Opportunity intelligence report

Example layout for a real opportunity after research is completed.

AI overview

What the program is, who it accepts, why it may fit, and the most important issues to verify.

Eligibility analysis

Requirement-by-requirement status, supporting CV/profile evidence, source clauses and unresolved questions.

Financial analysis

Confirmed tuition coverage, living allowance, travel support, insurance and anticipated uncovered costs.

Deadline and requirements

Deadline, timezone, documents, application sequence, recommendation letters and any supervisor-contact requirement.

Competitiveness assessment

Published selectivity indicators where available; otherwise an explicit statement that competition cannot be reliably estimated.

Evidence and source references

Clickable original sources, relevant quotations, page numbers for PDFs, retrieval dates and conflicting information where found.

The agent should investigate beyond the initial link where useful. For example, a student may paste a fellowship PDF. The agent reads it, identifies the official program and then checks the program website for updates, funding details, nationality restrictions and submission instructions. Every additional claim should have traceable evidence.

This type of tool-based workflow is technically feasible using current model APIs with web search, document retrieval and custom function calls. See the [OpenAI API tools documentation](https://developers.openai.com/api/docs/guides/tools?utm_source=chatgpt.com).

## 4. The application workspace should carry the student from interest to submission

Once a student saves an opportunity, it should become its own workspace—not just another bookmarked link.

The workspace should understand which documents the student has, what the program requires, what remains missing, and which drafts have been prepared.

My documents

CVs, transcripts, language certificates and other supporting documents. Extracted facts can be corrected and reused with consent.

Writing studio

Editable motivation letters, research statements and emails to potential supervisors or recommenders. Compare revisions and retain version history.

Application checklist

Track each requirement, its source, status, due date and next action.

Recommendation support

Draft polite request emails, prepare factual summaries of the student's work for a recommender, and manage recommendation-letter requirements without impersonating the recommender.

Context-aware agent

Ask questions about this call, request a tailored revision, investigate an unclear condition, or ask the agent to compare the opportunity with alternatives.

### The bottom composer: always available, always context-aware

A persistent Ask your agent composer can appear at the bottom of opportunity and application screens.

On an opportunity page, a question such as "Could my degree satisfy this requirement?" should use the opportunity's source text and the student's confirmed profile. In the writing studio, "Make this paragraph more specific" should operate on the selected paragraph and relevant program details.

The context changes with the task. The student should not have to repeat the CV, opportunity link or purpose of the document in every message.

## 5. Monitoring should be a saved mission, not a separate product

The same intelligence engine can monitor relevant developments after the initial research.

The student might say:

> "Keep watching this opportunity. Tell me if the deadline changes, applications open, funding is updated, or the eligibility criteria change."

The agent saves the mission, checks the supported sources at a declared frequency and compares new content with the previous snapshot. When it detects a meaningful change, it sends an alert that states what changed, why it matters, what source confirms it, and what the student should do next.

Monitoring can also continue at the discovery level: alert the student when a newly discovered opportunity passes their predefined fit, eligibility and funding criteria. The student should control notification preferences and be able to pause or stop each mission.

A critical limitation must remain visible: checks only detect changes that the configured sources expose and the monitoring system can retrieve. The platform should display the last successful check and report failures instead of pretending that an inaccessible site was checked.

For LinkedIn, we must also distinguish ordinary account sign-in from permission to retrieve posts. The Posts API documents `r_member_social` as a restricted permission available to approved users. The fallback should be user-provided post text or links and other lawfully accessible content, not unauthorized scraping. [LinkedIn Posts API permissions](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-06\&utm_source=chatgpt.com).

## 6. What I would build first for Thirduni

The full vision is substantial. With the October 31 deadline approaching, the most important decision is to implement a coherent, complete journey rather than make every future feature visible.

## First-release priorities

Must work

Conversational mission builder

Ask adaptive questions, remember preferences and let students change their goals.

Must work

CV upload + profile extraction

Extract structured qualifications, allow correction, and use the confirmed profile for matching.

Must work

Paste a link or upload a PDF

Retrieve the source, extract requirements, investigate related official pages and produce grounded analysis.

Must work

Dynamic findings + deep analysis

Fit score, eligibility, funding, deadline, evidence, direct links, follow-up questions and a not-interested feedback action.

Must work

Writing studio

Generate and edit at least one useful application document, preserve revisions and save the result.

Must work

Real monitoring and alerts

Monitor a supported source, detect a controlled change and deliver a real notification with execution history.

Later

Broad LinkedIn access, many providers and automatic application submissions

Build only when the required permissions, validation and security controls are in place.

I would add one important engineering requirement: every result and alert needs a source trail and a clear state. If the agent is uncertain, the interface should say exactly which fact is missing or contradictory. If a tool fails, it should report that failure. If the user dismisses an opportunity, that feedback should be saved.

That creates a product that is intelligent without pretending to be infallible.

The real innovation is not the number of AI features. It is the continuity of the experience: the agent understands the student's goal, investigates opportunities, shows its evidence, adapts when the student responds, helps prepare the application, and keeps watching for developments that matter. That is the version worth building.