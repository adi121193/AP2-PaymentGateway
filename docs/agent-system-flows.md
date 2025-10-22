# FrameOS Agent Runtime - System Flows

**Version:** 1.0
**Date:** 2025-10-20

This document provides detailed flow diagrams for all major system operations in the FrameOS Agent Runtime.

---

## Table of Contents

1. [Agent Publishing Flow (Developer)](#agent-publishing-flow-developer)
2. [Agent Execution Flow (User)](#agent-execution-flow-user)
3. [Payment Processing Flow](#payment-processing-flow)
4. [Code Scanning Flow](#code-scanning-flow)
5. [Queue Processing Flow](#queue-processing-flow)
6. [Revenue Distribution Flow](#revenue-distribution-flow)

---

## Agent Publishing Flow (Developer)

```
┌─────────────────────────────────────────────────────────┐
│ DEVELOPER ACTION: Publish New Agent                     │
└─────────────────────────────────────────────────────────┘

Step 1: Developer Preparation
┌──────────────────────────┐
│ Developer writes agent   │
│ - index.js (or main.py)  │
│ - manifest.json          │
│ - package.json           │
│ - README.md              │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Developer tests locally  │
│ - node index.js          │
│ - Validates inputs       │
│ - Checks outputs         │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Developer packages code  │
│ - tar -czf agent.tar.gz  │
│ - Base64 encode          │
└──────────┬───────────────┘
           │
           ↓

Step 2: Registration Request
┌──────────────────────────┐
│ POST /agents/register    │
│                          │
│ Headers:                 │
│   Authorization: Bearer  │
│   Idempotency-Key: uuid  │
│                          │
│ Body:                    │
│   name: "LinkedIn Agent" │
│   slug: "linkedin-agent" │
│   version: "1.0.0"       │
│   manifest: {...}        │
│   code_base64: "H4sI..." │
└──────────┬───────────────┘
           │
           ↓

Step 3: Platform Processing
┌──────────────────────────┐
│ API Server Receives      │
│                          │
│ 1. Validate JWT          │
│ 2. Check developer auth  │
│ 3. Validate manifest     │
│ 4. Check slug unique     │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Decode Base64 code       │
│ Extract tar.gz           │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ CODE SCANNER             │
│                          │
│ 1. AST parsing           │
│ 2. Pattern detection     │
│ 3. Dependency scan       │
│ 4. Size check (<10MB)    │
└──────────┬───────────────┘
           │
           ↓
        ┌──┴──┐
        │ OK? │
        └──┬──┘
           │
      ┌────┴────┐
      │         │
     YES       NO
      │         │
      │         ↓
      │    ┌─────────────────┐
      │    │ Return 400      │
      │    │ {               │
      │    │   error: {      │
      │    │     code:       │
      │    │     "SCAN_FAIL" │
      │    │     violations  │
      │    │   }             │
      │    │ }               │
      │    └─────────────────┘
      │
      ↓
┌──────────────────────────┐
│ Upload to S3             │
│                          │
│ Key: agents/             │
│      agt_abc/            │
│      v1.0.0.tar.gz       │
│                          │
│ Metadata:                │
│   agent_id, version,     │
│   uploaded_at            │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Create Database Records  │
│                          │
│ 1. AgentDefinition       │
│    - id, slug, name      │
│    - status: pending     │
│                          │
│ 2. AgentVersion          │
│    - version: 1.0.0      │
│    - code_s3_key         │
│    - code_hash (SHA256)  │
│    - scan_passed: true   │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Return 201 Created       │
│                          │
│ {                        │
│   success: true,         │
│   data: {                │
│     agent_id: "agt_abc"  │
│     status: "pending"    │
│     message: "Submitted  │
│       for review"        │
│   }                      │
│ }                        │
└──────────┬───────────────┘
           │
           ↓

Step 4: Manual Approval (Phase 1)
┌──────────────────────────┐
│ Admin Dashboard          │
│                          │
│ - Views pending agents   │
│ - Reviews code manually  │
│ - Tests agent execution  │
└──────────┬───────────────┘
           │
      ┌────┴────┐
      │ Approve?│
      └────┬────┘
           │
      ┌────┴────┐
      │         │
  APPROVE    REJECT
      │         │
      │         ↓
      │    ┌─────────────────┐
      │    │ UPDATE agents   │
      │    │ SET status =    │
      │    │   "rejected"    │
      │    │                 │
      │    │ Email developer │
      │    │ with reason     │
      │    └─────────────────┘
      │
      ↓
┌──────────────────────────┐
│ UPDATE agents            │
│ SET status =             │
│   "published"            │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Agent appears in         │
│ marketplace!             │
│                          │
│ GET /agents              │
│ → Shows this agent       │
└──────────────────────────┘
```

---

## Agent Execution Flow (User)

```
┌─────────────────────────────────────────────────────────┐
│ USER ACTION: Execute Agent                              │
└─────────────────────────────────────────────────────────┘

Step 1: Deployment (One-time setup)
┌──────────────────────────┐
│ User browses marketplace │
│ GET /agents?category=... │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ User finds agent         │
│ GET /agents/:slug        │
│                          │
│ - Reads description      │
│ - Checks pricing         │
│ - Views reviews          │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ POST /agents/:id/deploy  │
│                          │
│ Body:                    │
│   version: "1.2.3"       │
│   config: {              │
│     linkedin_session:    │
│       "AQEDARqS...",     │
│     max_requests: 50     │
│   }                      │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Platform creates         │
│ AgentDeployment record   │
│                          │
│ - user_id                │
│ - agent_id               │
│ - version: "1.2.3"       │
│ - config: {...}          │
│   (encrypted in DB)      │
│ - status: "configured"   │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Return 201 Created       │
│ {                        │
│   deployment_id: "dep_x" │
│   status: "configured"   │
│   message: "Ready to     │
│     execute"             │
│ }                        │
└──────────────────────────┘

Step 2: Execution Trigger
┌──────────────────────────┐
│ POST /agents/:id/execute │
│                          │
│ Body:                    │
│   deployment_id: "dep_x" │
│   inputs: {              │
│     target_profile_url:  │
│       "linkedin.com/..."│
│   }                      │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Validate inputs          │
│ - Check against manifest │
│ - Required fields?       │
│ - Type validation        │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Calculate cost           │
│ - From agent manifest    │
│ - pricing_model:         │
│     per_execution        │
│ - price_amount: 50       │
└──────────┬───────────────┘
           │
           ↓

Step 3: Payment Pre-Authorization
┌──────────────────────────┐
│ POST /purchase-intents   │
│ (C-Layer API)            │
│                          │
│ {                        │
│   agent_id: "agt_user"   │
│   vendor: "frameos"      │
│   amount: 50,            │
│   currency: "INR",       │
│   description: "Agent    │
│     execution",          │
│   metadata: {            │
│     execution_id         │
│   }                      │
│ }                        │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ C-Layer validates policy │
│ - Vendor allowlisted?    │
│ - Amount ≤ cap?          │
│ - Daily limit OK?        │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ POST /mandates           │
│ (C-Layer API)            │
│                          │
│ {                        │
│   intent_id: "pi_xyz"    │
│ }                        │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ C-Layer signs mandate    │
│ - Ed25519 signature      │
│ - Expires in 10 minutes  │
│                          │
│ Returns:                 │
│ {                        │
│   mandate_id: "mdt_abc"  │
│   signature: "..."       │
│   expires_at             │
│ }                        │
└──────────┬───────────────┘
           │
           ↓

Step 4: Queue Execution
┌──────────────────────────┐
│ Create AgentExecution    │
│ record                   │
│                          │
│ - id: exec_123           │
│ - deployment_id          │
│ - agent_id               │
│ - user_id                │
│ - purchase_intent_id     │
│ - mandate_id             │
│ - inputs: {...}          │
│ - status: "queued"       │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Enqueue job in BullMQ    │
│                          │
│ {                        │
│   execution_id,          │
│   priority: paid ? 10:1  │
│   attempts: 3,           │
│   timeout: 300000        │
│ }                        │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Return 202 Accepted      │
│                          │
│ {                        │
│   success: true,         │
│   data: {                │
│     execution_id,        │
│     status: "queued",    │
│     poll_url:            │
│       "/executions/..." │
│   }                      │
│ }                        │
└──────────────────────────┘

Step 5: User Polling
┌──────────────────────────┐
│ User polls every 2s      │
│ GET /executions/:id      │
└──────────┬───────────────┘
           │
           ↓ (queued)
┌──────────────────────────┐
│ {                        │
│   status: "queued",      │
│   created_at             │
│ }                        │
└──────────────────────────┘

           ↓ (running)
┌──────────────────────────┐
│ {                        │
│   status: "running",     │
│   started_at,            │
│   elapsed_ms: 8500       │
│ }                        │
└──────────────────────────┘

           ↓ (success)
┌──────────────────────────┐
│ {                        │
│   status: "success",     │
│   completed_at,          │
│   duration_ms: 12340,    │
│   outputs: {             │
│     connection_sent: true│
│   },                     │
│   payment: {             │
│     amount: 50,          │
│     receipt_id           │
│   }                      │
│ }                        │
└──────────────────────────┘
```

---

## Payment Processing Flow

```
┌─────────────────────────────────────────────────────────┐
│ PAYMENT FLOW: Pre-Auth → Execute → Distribute           │
└─────────────────────────────────────────────────────────┘

Timeline:
T+0s: Agent execution queued
  │
  ↓
T+0s: Mandate created (pre-authorization)
  │
  ↓
T+0s - T+300s: Agent executes (up to 5 minutes)
  │
  ↓
T+Xs: Agent completes (success or failure)
  │
  ↓
  ┌────────────┐
  │ Success?   │
  └────┬───────┘
       │
  ┌────┴────┐
  │         │
 YES       NO
  │         │
  │         ↓
  │    ┌─────────────────┐
  │    │ NO PAYMENT      │
  │    │                 │
  │    │ - Mandate       │
  │    │   expires       │
  │    │ - User charged  │
  │    │   ₹0.00         │
  │    │ - Developer     │
  │    │   earns ₹0.00   │
  │    └─────────────────┘
  │
  ↓
┌──────────────────────────┐
│ POST /execute            │
│ (C-Layer API)            │
│                          │
│ {                        │
│   mandate_id: "mdt_abc"  │
│ }                        │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ C-Layer validates        │
│ - Mandate not expired?   │
│ - Signature valid?       │
│ - Policy still valid?    │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ C-Layer routes payment   │
│                          │
│ Decision tree:           │
│ - Amount ≤ 200 paise?    │
│   → x402                 │
│ - Amount > 200?          │
│   → Cashfree/Stripe      │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Payment rail executes    │
│ (Stripe/Cashfree/x402)   │
│                          │
│ User charged:            │
│ ₹0.50 (50 paise)         │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ C-Layer creates Payment  │
│ record                   │
│                          │
│ - id: pay_xyz            │
│ - mandate_id             │
│ - amount: 50             │
│ - status: "settled"      │
│ - provider: "cashfree"   │
│ - provider_ref           │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ C-Layer creates Receipt  │
│ (hash chain)             │
│                          │
│ - id: rcpt_123           │
│ - payment_id             │
│ - hash: sha256(...)      │
│ - prev_hash              │
│ - chain_index            │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ B-Layer receives         │
│ payment_id + receipt_id  │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ UPDATE agent_executions  │
│ SET payment_id =         │
│   "pay_xyz"              │
└──────────┬───────────────┘
           │
           ↓

Revenue Distribution:
┌──────────────────────────┐
│ Calculate split:         │
│                          │
│ Total: ₹0.50 (50 paise)  │
│                          │
│ Developer (70%): 35      │
│ Platform (20%): 10       │
│ Orchestrator (10%): 5    │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Create DeveloperRevenue  │
│ record                   │
│                          │
│ - developer_id           │
│ - agent_id               │
│ - execution_id           │
│ - amount: 35             │
│ - currency: "INR"        │
│ - status: "pending"      │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ UPDATE developers        │
│ SET total_revenue =      │
│   total_revenue + 35     │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Platform keeps: 10 paise │
│ (recorded in internal    │
│  accounting)             │
└──────────────────────────┘
```

---

## Code Scanning Flow

```
┌─────────────────────────────────────────────────────────┐
│ CODE SCANNER: Static Analysis & Pattern Detection       │
└─────────────────────────────────────────────────────────┘

Input: Agent code (Base64-encoded tar.gz)

Step 1: Decode & Extract
┌──────────────────────────┐
│ Base64 decode            │
│ Decompress tar.gz        │
│                          │
│ Extracted files:         │
│ - index.js               │
│ - package.json           │
│ - README.md              │
└──────────┬───────────────┘
           │
           ↓

Step 2: Size Check
┌──────────────────────────┐
│ Check total size         │
│                          │
│ Max allowed: 10 MB       │
└──────────┬───────────────┘
           │
      ┌────┴────┐
      │ Size OK?│
      └────┬────┘
           │
      ┌────┴────┐
      │         │
     YES       NO
      │         │
      │         ↓
      │    ┌─────────────────┐
      │    │ REJECT          │
      │    │ "Code too large"│
      │    └─────────────────┘
      │
      ↓

Step 3: Pattern Scanning
┌──────────────────────────┐
│ Scan each .js/.py file   │
│ for dangerous patterns   │
│                          │
│ Patterns:                │
│ - require('fs')          │
│ - child_process          │
│ - eval()                 │
│ - Function()             │
│ - Crypto addresses       │
│ - Obfuscated code        │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ For each pattern:        │
│                          │
│ if (pattern.test(code)) {│
│   violations.push({      │
│     pattern,             │
│     line: findLine(),    │
│     severity: "HIGH"     │
│   });                    │
│ }                        │
└──────────┬───────────────┘
           │
           ↓
      ┌────┴────────┐
      │ Violations? │
      └────┬────────┘
           │
      ┌────┴────┐
      │         │
     YES       NO
      │         │
      │         ↓
      │    ┌─────────────────┐
      │    │ PASS            │
      │    │ scan_passed:    │
      │    │   true          │
      │    └─────────────────┘
      │
      ↓
┌──────────────────────────┐
│ Check severity           │
└──────────┬───────────────┘
           │
      ┌────┴────┐
      │ HIGH?   │
      └────┬────┘
           │
      ┌────┴────┐
      │         │
     YES       NO
      │         │
      │         ↓
      │    ┌─────────────────┐
      │    │ FLAG FOR REVIEW │
      │    │                 │
      │    │ scan_passed:    │
      │    │   false         │
      │    │ scan_report: {  │
      │    │   warnings: [...│
      │    │ }               │
      │    │                 │
      │    │ Status:         │
      │    │ "pending_review"│
      │    └─────────────────┘
      │
      ↓
┌──────────────────────────┐
│ REJECT                   │
│                          │
│ scan_passed: false       │
│ scan_report: {           │
│   violations: [          │
│     {                    │
│       pattern: "eval()", │
│       line: 42,          │
│       severity: "HIGH",  │
│       message:           │
│         "Dynamic code    │
│          execution       │
│          not allowed"    │
│     }                    │
│   ]                      │
│ }                        │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Return to developer      │
│                          │
│ {                        │
│   error: {               │
│     code: "SCAN_FAILED", │
│     violations: [...]    │
│   }                      │
│ }                        │
└──────────────────────────┘

Step 4: Dependency Scan
┌──────────────────────────┐
│ Parse package.json       │
│                          │
│ Check dependencies:      │
│ - Known malicious pkgs?  │
│ - Deprecated packages?   │
│ - Version mismatches?    │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Log scan results         │
│                          │
│ Store in scan_report:    │
│ {                        │
│   scanned_at,            │
│   files_scanned,         │
│   violations,            │
│   warnings,              │
│   dependencies_checked   │
│ }                        │
└──────────────────────────┘
```

---

## Queue Processing Flow

```
┌─────────────────────────────────────────────────────────┐
│ BULLMQ WORKER: Job Processing                           │
└─────────────────────────────────────────────────────────┘

Worker Startup:
┌──────────────────────────┐
│ Worker connects to Redis │
│                          │
│ const worker = new       │
│   Worker('executions',   │
│   processJob, {          │
│     concurrency: 5       │
│   });                    │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Worker polls queue       │
│ (blocking BRPOP)         │
└──────────┬───────────────┘
           │
           ↓ (job available)

Job Processing:
┌──────────────────────────┐
│ Worker picks job         │
│                          │
│ Job data:                │
│ {                        │
│   execution_id,          │
│   priority: 10,          │
│   attempts: 1            │
│ }                        │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ UPDATE agent_executions  │
│ SET status = "running",  │
│     started_at = NOW(),  │
│     worker_id = $1       │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Fetch execution record   │
│ from database            │
│                          │
│ - agent_id               │
│ - deployment_id          │
│ - inputs                 │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Fetch agent version      │
│ - code_s3_key            │
│ - runtime_language       │
│ - timeout_ms             │
│ - memory_mb              │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Download code from S3    │
│                          │
│ const code = await       │
│   s3.getObject({         │
│     Key: code_s3_key     │
│   });                    │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Verify code hash         │
│                          │
│ const hash = sha256(code)│
│ if (hash !== code_hash)  │
│   throw Error("Tamper")  │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Extract code to temp dir │
│                          │
│ /tmp/exec_123/           │
│   ├── index.js           │
│   ├── package.json       │
│   └── node_modules/      │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Build Docker command     │
│                          │
│ docker run \             │
│   --network=none \       │
│   --read-only \          │
│   --cpus=1.0 \           │
│   --memory=512m \        │
│   --env INPUTS='{"..."}' │
│   --volume /tmp/exec_123 │
│   agent-runtime:latest \ │
│   node index.js          │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Execute with timeout     │
│                          │
│ const result = await     │
│   execWithTimeout(       │
│     cmd,                 │
│     timeout_ms           │
│   );                     │
└──────────┬───────────────┘
           │
           ↓
      ┌────┴────────┐
      │ Exit code?  │
      └────┬────────┘
           │
      ┌────┴────┐
      │         │
     0         non-0
  (success)   (failed)
      │         │
      │         ↓
      │    ┌─────────────────┐
      │    │ UPDATE executions│
      │    │ SET status =     │
      │    │   "failed",      │
      │    │   error_message, │
      │    │   stderr,        │
      │    │   exit_code      │
      │    │                  │
      │    │ NO PAYMENT       │
      │    └─────────────────┘
      │
      ↓
┌──────────────────────────┐
│ Parse stdout as JSON     │
│                          │
│ outputs = JSON.parse(    │
│   result.stdout          │
│ );                       │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ EXECUTE PAYMENT          │
│ (See Payment Flow)       │
│                          │
│ POST /execute (C-Layer)  │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ UPDATE agent_executions  │
│ SET status = "success",  │
│     completed_at = NOW(),│
│     duration_ms,         │
│     outputs,             │
│     payment_id           │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Cleanup Docker container │
│                          │
│ docker rm -f exec_123    │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Job complete             │
│ Worker polls for next job│
└──────────────────────────┘

Error Handling:
┌──────────────────────────┐
│ If job fails (error):    │
│                          │
│ - Attempts < 3?          │
│   → Retry (backoff)      │
│ - Attempts >= 3?         │
│   → Mark failed          │
└──────────────────────────┘
```

---

## Revenue Distribution Flow

```
┌─────────────────────────────────────────────────────────┐
│ REVENUE DISTRIBUTION: 70% Dev / 20% Platform / 10% Orch │
└─────────────────────────────────────────────────────────┘

After successful payment:

Input: payment_id = "pay_xyz" (amount: 50 paise = ₹0.50)

Step 1: Fetch Payment Details
┌──────────────────────────┐
│ SELECT * FROM payments   │
│ WHERE id = 'pay_xyz'     │
│                          │
│ Result:                  │
│ - amount: 50             │
│ - currency: INR          │
│ - mandate_id             │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Fetch execution details  │
│ (to get agent_id,        │
│  developer_id)           │
│                          │
│ SELECT * FROM            │
│   agent_executions       │
│ WHERE payment_id =       │
│   'pay_xyz'              │
└──────────┬───────────────┘
           │
           ↓

Step 2: Calculate Split
┌──────────────────────────┐
│ Total: 50 paise          │
│                          │
│ Developer (70%):         │
│   50 × 0.70 = 35 paise   │
│                          │
│ Platform (20%):          │
│   50 × 0.20 = 10 paise   │
│                          │
│ Orchestrator (10%):      │
│   50 × 0.10 = 5 paise    │
│   (if orchestrated)      │
└──────────┬───────────────┘
           │
           ↓

Step 3: Credit Developer
┌──────────────────────────┐
│ INSERT INTO              │
│   developer_revenue      │
│                          │
│ {                        │
│   developer_id: "dev_123"│
│   agent_id: "agt_abc",   │
│   execution_id: "exec_x",│
│   amount: 35,            │
│   currency: "INR",       │
│   status: "pending"      │
│ }                        │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ UPDATE developers        │
│ SET total_revenue =      │
│   total_revenue + 35     │
│ WHERE id = 'dev_123'     │
└──────────┬───────────────┘
           │
           ↓

Step 4: Record Platform Revenue
┌──────────────────────────┐
│ INSERT INTO              │
│   platform_revenue       │
│   (internal table)       │
│                          │
│ {                        │
│   execution_id,          │
│   amount: 10,            │
│   created_at: NOW()      │
│ }                        │
└──────────┬───────────────┘
           │
           ↓

Step 5: Payout Scheduling (Weekly)
┌──────────────────────────┐
│ Every Monday 00:00 UTC:  │
│                          │
│ SELECT developer_id,     │
│   SUM(amount) as total   │
│ FROM developer_revenue   │
│ WHERE status = 'pending' │
│ GROUP BY developer_id    │
│ HAVING total >= 50000    │
│   (₹500 minimum)         │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ For each developer:      │
│                          │
│ 1. Create payout via     │
│    Cashfree Payouts API  │
│                          │
│ 2. UPDATE developer_     │
│    revenue               │
│    SET status =          │
│      'paid_out',         │
│      paid_out_at = NOW(),│
│      payout_ref = $1     │
│                          │
│ 3. Send email            │
│    notification          │
└──────────────────────────┘
```

---

**End of System Flows Document**

All flows represent Phase 1 implementation. Phase 2 may introduce:
- WebSocket-based real-time execution updates (no polling)
- Agent-to-agent orchestration (complex revenue splits)
- Subscription billing (recurring mandates)
- Multi-region execution (geo-distributed workers)
