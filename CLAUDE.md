CLAUDE.md — AP2-Native Agent Payment Gateway

Mission: Ship a rail-agnostic gateway that turns PurchaseIntent → Mandate → Payment → Receipt into a policy-safe, auditable flow.
Stack: Node 20+, TypeScript, Express/Hono, Postgres (Neon), Prisma, Stripe (test), x402-shim (HTTP), libsodium (Ed25519).
Non-negotiables: Policy-first; idempotent writes; cryptographic evidence; zero secrets in code.

0) How to Work With Me (Claude Code)

Always follow: Context → Plan → Implementation → Validation in every reply.

Ask at most once for critical ambiguity; otherwise proceed with best-effort defaults.

Prefer spec-first: define types (Zod) + OpenAPI, then handlers + tests, then docs/examples.

Keep diffs small; include test + docs in the same PR.

Never run destructive bash unless I explicitly ask (see Allowed Tools).

Useful commands for me (Claude Code):

/agents to view/create/edit subagents; store project agents under .claude/agents/.

/permissions to manage allowed tools (see allowlist below).

/output-style learning if I ask you to teach and add TODO(human) markers.

1) Repo Shape & Source of Truth
agent-gateway/
  apps/api/src/
    routes/ (intents.ts, mandates.ts, execute.ts, receipts.ts)
    middleware/ (idempotency.ts, auth.ts, error.ts)
    services/ (policy.ts, mandate.ts, router.ts, receipts.ts)
  packages/domain/ (zod types, DTOs, env schema)
  packages/rails/ (stripe.ts, x402.ts)
  packages/receipts/ (hash-chain helpers)
  infra/ (docker, railway, scripts)
  tests/ (unit, integration, e2e)
  docs/ (openapi.yaml, runbooks, demo)
  .claude/agents/ (project subagents)
  CLAUDE.md


Authoritative specs live in: packages/domain (types), docs/openapi.yaml (API), and packages/rails/* (adapter contracts). If code and spec diverge: spec wins.

2) Golden Rules (Policy & Security)

Default-deny: reject any purchase if policy check fails (SKU, caps, geo/time, velocity).

Idempotency: all mutating endpoints require Idempotency-Key; enforce unique (key, route) in DB.

Signatures: sign Mandate and Receipt with Ed25519 using MANDATE_SIGN_KEY from env.

Tamper evidence: each Receipt must link prev_hash → curr_hash (per agent chain).

Secrets: load via env.ts (Zod-validated). No plaintext keys in code or logs.

Webhooks: verify Stripe signatures; for x402-shim require HMAC + idempotency.

Observability: structured logs (pino), redacted; metrics for errors/min and money/day.

3) Environment Contract (Zod)

Create packages/domain/src/env.ts:

import { z } from "zod";
export const Env = z.object({
  NODE_ENV: z.enum(["development","test","production"]),
  DATABASE_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  MANDATE_SIGN_KEY: z.string().min(64), // hex or base64; libsodium compatible
  JWT_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string().default("*"),
});


Crash startup if Env.parse(process.env) fails.

4) Data Model (Prisma sketch)
model Agent {
  id            String  @id @default(cuid())
  name          String
  api_key_hash  String
  status        String   @default("active")
  risk_tier     String   @default("LOW")
  policies      Policy[]
  intents       PurchaseIntent[]
  receipts      Receipt[]
}

model Policy {
  id          String  @id @default(cuid())
  agent_id    String
  version     Int
  sku_allow   Json
  limits      Json     // { per_txn_minor, daily_minor, velocity }
  geo         Json     // { allow: ["IN","EU"], deny: [] }
  time        Json     // { start:"08:00", end:"20:00", tz:"Asia/Kolkata" }
  created_at  DateTime @default(now())
  @@unique([agent_id, version])
}

model PurchaseIntent {
  id           String  @id @default(cuid())
  agent_id     String
  sku          String
  amount_minor Int
  currency     String
  meta         Json
  status       String   @default("PENDING")
  created_at   DateTime @default(now())
}

model Mandate {
  id          String  @id @default(cuid())
  intent_id   String  @unique
  template    String  // micro-task | recurring-budget | exceptional
  scope       Json    // { sku, vendor }
  caps        Json    // { per_txn_minor, daily_minor, velocity }
  approvers   Json    // [emails]
  sig         String
  status      String  @default("ACTIVE")
  expires_at  DateTime
  created_at  DateTime @default(now())
}

model Payment {
  id           String  @id @default(cuid())
  mandate_id   String
  rail         String  // stripe_card | upi | x402_shim
  provider_ref String?
  amount_minor Int
  currency     String
  status       String  @default("INITIATED")
  created_at   DateTime @default(now())
}

model Receipt {
  id           String  @id @default(cuid())
  mandate_id   String
  policy_hash  String
  mandate_hash String
  rail         String
  payment_ref  String?
  ts           DateTime @default(now())
  prev_hash    String?
  curr_hash    String
  agent_id     String
  created_at   DateTime @default(now())
  @@index([agent_id, created_at])
}

5) API Surface & Acceptance Criteria
POST /purchase-intents

Validates body: {agent_id, sku, amount_minor, currency, meta?} (Zod).

Checks: agent exists + status active + SKU allowlisted in latest Policy.

Returns: {intent_id}.

POST /mandates

Input: {intent_id, template, scope{sku,vendor}, caps{per_txn_minor,daily_minor,velocity}, approvers[], valid_for_sec}.

Policy gate: canIssueMandate() enforces caps, geo/time, velocity (unit tests required).

Signs: compute mandate_hash (stable JSON) and Ed25519 sig.

Returns: {mandate_id, sig, expires_at}.

POST /execute

Refuses if mandate expired, invalid signature, exceeded caps, or vendor not allowed.

Calls Rail Router:

If amount_minor ≤ 200 and policy permits → x402_shim.

Else → Stripe Payment Intents (test mode).

Risk override: if risk_tier=HIGH → Stripe.

Persists Payment and emits a Receipt with hash chain.

GET /receipts/:id

Returns the uniform receipt: {mandate_hash, policy_hash, rail, txn_ref, ts, prev_hash, curr_hash}.

Add CSV export: /exports/statement?from=...&to=....

Every endpoint must ship with:

Zod schema;

OpenAPI entry + example cURL;

Unit tests (3 positive + 3 negative);

Idempotent behavior verified.

6) Mandate & Receipt Hashing
// packages/receipts/hash.ts
import { createHash } from "crypto";
export const stable = (o:any)=>JSON.stringify(o, Object.keys(o).sort());
export const sha256 = (s:string)=>"sha256:"+createHash("sha256").update(s).digest("hex");

export function mandateHash(m:{scope:any,caps:any,approvers:any,expires_at:string}) {
  return sha256(stable(m));
}

export function receiptHash(r:{
  mandate_hash:string, policy_hash:string, payment_ref:string|undefined, ts:string, prev_hash?:string
}) {
  return sha256(stable(r));
}


Nightly job: re-verify the chain per agent_id. Alert on mismatches.

7) Idempotency Middleware (Contract)

Require header Idempotency-Key on all POST/PUT/DELETE.

DB table idempotency(route, key) UNIQUE.

On duplicate, replay stored response payload + status (no side effects).

8) Rail Adapters (Interface & Router)
// packages/rails/interface.ts
export interface RailAdapter {
  name: "stripe_card" | "x402_shim";
  executePayment(args:{
    mandate_id:string; amount_minor:number; currency:string; merchant_ref:string;
  }): Promise<{ ok:boolean; provider_ref?:string; error?:string }>;
  verifyWebhook(payload:any, signature:string): boolean;
}


stripe.ts: uses Payment Intents; verifies webhook signature; test cards only.

x402.ts: signed HTTP POST to your shim with idempotency; return settlement_ref.

Router v0: simple heuristic (amount/risk); injectable policy overrides.

9) Subagent Collaboration (Your Current Team)

Use /agents to edit and store these as project agents in .claude/agents/. Claude should auto-delegate; explicitly invoke when needed.

system-architect → author/maintain data model, service boundaries, and migration plans.

backend-developer → implement validated handlers, services, and middleware with tests.

devops-engineer → Dockerfile, Railway deploy, healthchecks, and secrets wiring.

qa-tester → Vitest (unit/integration), coverage ≥ 90% on domain; negative cases mandatory.

code-reviewer → run git diff reviews; enforce style & security checklists.

project-manager → maintain /docs/devlog.md, backlog, and weekly milestone notes.

frontend-developer (optional) → minimal admin panel (React/Tailwind).

n8n-developer (optional) → alerting workflows (if you choose to use n8n later).

Tip: In each subagent’s description, include phrases like “Use PROACTIVELY after code changes” for Code Reviewer and “MUST BE USED for running tests & fixing failures” for QA to encourage automatic delegation.

10) Allowed Tools & Safety

Allow by default (via /permissions):

Read, Edit, Grep, Glob, Bash(node|npm|pnpm|git|prisma|vitest|curl), GitHub(gh:read PRs).

Ask every time:

Bash(rm*|sudo*|chmod -R*|curl|wget > /usr/*); npm install -g; system package managers.

Never (unless I explicitly request):

Network writes to unknown hosts; modifying .ssh; rotating keys.

11) Quality Bars (Ship Criteria)

Tests: ≥ 90% domain coverage; each endpoint: 3 positive + 3 negative.

Latency: p95 < 120ms on free tier for simple requests.

Docs: OpenAPI complete for 4 endpoints; cURL examples compile.

Receipts: 100% hash-chain continuity by nightly verifier.

Security: No secrets in code; env schema validated; webhook signatures enforced.

12) Daily Dev Ritual (for me + subagents)

Plan: create/confirm ticket; propose spec diffs.

Build: types → handler → tests → docs.

Validate: run tests, lint, typecheck, e2e demo script.

Document: update docs/demo/commands.md and docs/devlog.md.

Open PR: include risks + rollback; request code-reviewer.

Deploy: staging on Railway; smoke test /healthz + demo flow.

13) Demo Script (7-minute E2E)
# 1) Intent
curl -s -XPOST $API/purchase-intents \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-001" \
  -d '{"agent_id":"agt_demo","sku":"enrich","amount_minor":199,"currency":"INR","meta":{"job_id":"J-1"}}'

# 2) Mandate
curl -s -XPOST $API/mandates \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-002" \
  -d '{"intent_id":"<PI>","template":"micro-task","scope":{"sku":"enrich","vendor":"acme_api"},"caps":{"per_txn_minor":200,"daily_minor":2000,"velocity":10},"approvers":["ops@yourco"],"valid_for_sec":600}'

# 3) Execute
curl -s -XPOST $API/execute -H "Idempotency-Key: demo-003" -d '{"mandate_id":"<MDT>"}'

# 4) Receipt
curl -s $API/receipts/<RCPT_ID>

14) Checklists

Endpoint checklist

 Zod schema & OpenAPI updated

 Auth & idempotency wired

 Policy gates enforced

 Unit + integration tests written

 Structured logging with redaction

 cURL example in docs/

Security checklist

 No logs of secrets or PAN data

 Webhooks verified

 Ed25519 keys rotated quarterly

 Dependencies scanned (npm audit)

 Error messages non-sensitive

15) Scope Discipline

Don’t add new rails, SKUs, or dashboards unless I write “APPROVED: scope change”.

If a requirement is unclear, implement the simplest safe default and leave a // TODO: clarify.

Final note

When asked for code, propose diff-sized changes with filenames, snippets, and test commands.
Every session should end with a brief “What changed / What to review / Next” summary I can paste into docs/devlog.l
