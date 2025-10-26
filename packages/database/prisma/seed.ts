/**
 * AP2 Payment Gateway - Database Seed Script
 *
 * Populates database with realistic test data for development and testing.
 * Includes all 8 models with proper foreign key relationships and hash chains.
 *
 * Usage: npm run seed (from packages/database)
 */

import { PrismaClient } from '@prisma/client';
import { ed25519 } from '@noble/curves/ed25519';
import { generateReceiptHash, generateMandateHash } from '@ap2/receipts';

// Environment variables are loaded by dotenv-cli in package.json scripts
const prisma = new PrismaClient();

// ============================================================================
// CRYPTOGRAPHIC KEY PAIRS (Ed25519)
// ============================================================================

// Agent 1 Keys (Demo Agent - LOW risk)
const agent1PrivateKey = ed25519.utils.randomPrivateKey();
const agent1PublicKey = ed25519.getPublicKey(agent1PrivateKey);
const agent1PublicKeyHex = Buffer.from(agent1PublicKey).toString('hex');

// Agent 2 Keys (Research Agent - MEDIUM risk)
const agent2PrivateKey = ed25519.utils.randomPrivateKey();
const agent2PublicKey = ed25519.getPublicKey(agent2PrivateKey);
const agent2PublicKeyHex = Buffer.from(agent2PublicKey).toString('hex');

// Agent 3 Keys (Suspended Agent - HIGH risk)
const agent3PrivateKey = ed25519.utils.randomPrivateKey();
const agent3PublicKey = ed25519.getPublicKey(agent3PrivateKey);
const agent3PublicKeyHex = Buffer.from(agent3PublicKey).toString('hex');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate Ed25519 signature for mandate
 */
function signMandate(intentId: string, policyId: string, expiresAt: Date, privateKey: Uint8Array): string {
  const mandateHash = generateMandateHash({
    intent_id: intentId,
    policy_id: policyId,
    expires_at: expiresAt,
  });

  // Remove "sha256:" prefix and convert hex to bytes for signing
  const hashHex = mandateHash.replace('sha256:', '');
  const hashBytes = Buffer.from(hashHex, 'hex');

  const signature = ed25519.sign(hashBytes, privateKey);
  return Buffer.from(signature).toString('hex');
}

/**
 * Clear all existing data in correct order (respects foreign keys)
 */
async function clearDatabase() {
  console.log('🗑️  Clearing existing data...');

  // Clear marketplace economy tables
  await prisma.agentExecution.deleteMany();
  await prisma.agentDeployment.deleteMany();
  await prisma.agentVersion.deleteMany();
  await prisma.agentDefinition.deleteMany();
  await prisma.developerRevenue.deleteMany();
  await prisma.developer.deleteMany();

  // Clear payment gateway tables
  await prisma.receipt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.mandate.deleteMany();
  await prisma.purchaseIntent.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.idempotency.deleteMany();
  await prisma.vendorX402Endpoint.deleteMany();

  console.log('✅ Database cleared');
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clear existing data for clean slate
  await clearDatabase();

  // =========================================================================
  // 1. CREATE AGENTS (3 agents with different risk tiers)
  // =========================================================================
  console.log('👤 Creating agents...');

  const agent1 = await prisma.agent.create({
    data: {
      id: 'agt_demo_001',
      name: 'Demo AI Agent',
      public_key: agent1PublicKeyHex,
      status: 'active',
      risk_tier: 'LOW',
    },
  });

  const agent2 = await prisma.agent.create({
    data: {
      id: 'agt_research_002',
      name: 'Research Agent',
      public_key: agent2PublicKeyHex,
      status: 'active',
      risk_tier: 'MEDIUM',
    },
  });

  const agent3 = await prisma.agent.create({
    data: {
      id: 'agt_suspended_003',
      name: 'Suspended Agent',
      public_key: agent3PublicKeyHex,
      status: 'suspended',
      risk_tier: 'HIGH',
    },
  });

  console.log(`✅ Created ${3} agents`);
  console.log(`   - ${agent1.name} (${agent1.risk_tier}, ${agent1.status})`);
  console.log(`   - ${agent2.name} (${agent2.risk_tier}, ${agent2.status})`);
  console.log(`   - ${agent3.name} (${agent3.risk_tier}, ${agent3.status})\n`);

  // =========================================================================
  // 2. CREATE POLICIES (3 policies with varying caps)
  // =========================================================================
  console.log('📋 Creating policies...');

  const policy1 = await prisma.policy.create({
    data: {
      agent_id: agent1.id,
      version: 1,
      vendor_allowlist: ['acme_api', 'openai', 'anthropic'],
      amount_cap: 500, // $5.00 in cents
      daily_cap: 5000, // $50.00 in cents
      risk_tier: 'LOW',
      x402_enabled: true,
      expires_at: new Date('2026-12-31T23:59:59Z'),
    },
  });

  const policy2 = await prisma.policy.create({
    data: {
      agent_id: agent2.id,
      version: 1,
      vendor_allowlist: ['data_provider', 'research_api'],
      amount_cap: 200, // $2.00 in cents
      daily_cap: 1000, // $10.00 in cents
      risk_tier: 'MEDIUM',
      x402_enabled: false,
      expires_at: new Date('2026-06-30T23:59:59Z'),
    },
  });

  const policy3 = await prisma.policy.create({
    data: {
      agent_id: agent3.id,
      version: 1,
      vendor_allowlist: [],
      amount_cap: 100, // $1.00 in cents
      daily_cap: 500, // $5.00 in cents
      risk_tier: 'HIGH',
      x402_enabled: false,
      expires_at: new Date('2024-01-01T00:00:00Z'), // Already expired
    },
  });

  console.log(`✅ Created ${3} policies`);
  console.log(`   - Policy v${policy1.version} for ${agent1.name}: $${policy1.amount_cap/100} cap, x402=${policy1.x402_enabled}`);
  console.log(`   - Policy v${policy2.version} for ${agent2.name}: $${policy2.amount_cap/100} cap, x402=${policy2.x402_enabled}`);
  console.log(`   - Policy v${policy3.version} for ${agent3.name}: EXPIRED (${policy3.expires_at.toISOString()})\n`);

  // =========================================================================
  // 3. CREATE PURCHASE INTENTS (5 intents with different statuses)
  // =========================================================================
  console.log('💰 Creating purchase intents...');

  const intent1 = await prisma.purchaseIntent.create({
    data: {
      agent_id: agent1.id,
      vendor: 'acme_api',
      amount: 199,
      currency: 'USD',
      description: 'API enrichment call - address validation',
      metadata: { job_id: 'JOB-001', endpoint: '/v1/validate' },
      status: 'PENDING',
    },
  });

  const intent2 = await prisma.purchaseIntent.create({
    data: {
      agent_id: agent1.id,
      vendor: 'openai',
      amount: 150,
      currency: 'USD',
      description: 'GPT-4 completion - 1000 tokens',
      metadata: { model: 'gpt-4', tokens: 1000 },
      status: 'APPROVED', // Will have mandate
    },
  });

  const intent3 = await prisma.purchaseIntent.create({
    data: {
      agent_id: agent1.id,
      vendor: 'anthropic',
      amount: 250,
      currency: 'USD',
      description: 'Claude API call - code generation',
      metadata: { model: 'claude-3-sonnet', task: 'codegen' },
      status: 'EXECUTED', // Will have payment
    },
  });

  const intent4 = await prisma.purchaseIntent.create({
    data: {
      agent_id: agent2.id,
      vendor: 'expensive_service',
      amount: 1000,
      currency: 'USD',
      description: 'Expensive request (over limit)',
      metadata: { reason: 'rejected_over_cap' },
      status: 'REJECTED',
    },
  });

  const intent5 = await prisma.purchaseIntent.create({
    data: {
      agent_id: agent1.id,
      vendor: 'acme_api',
      amount: 50,
      currency: 'USD',
      description: 'Small API call (x402 eligible)',
      metadata: { x402_eligible: true, size: 'small' },
      status: 'PENDING',
    },
  });

  console.log(`✅ Created ${5} purchase intents`);
  console.log(`   - Intent 1: ${intent1.vendor} - $${intent1.amount/100} (${intent1.status})`);
  console.log(`   - Intent 2: ${intent2.vendor} - $${intent2.amount/100} (${intent2.status})`);
  console.log(`   - Intent 3: ${intent3.vendor} - $${intent3.amount/100} (${intent3.status})`);
  console.log(`   - Intent 4: ${intent4.vendor} - $${intent4.amount/100} (${intent4.status})`);
  console.log(`   - Intent 5: ${intent5.vendor} - $${intent5.amount/100} (${intent5.status})\n`);

  // =========================================================================
  // 4. CREATE MANDATES (2 mandates - 1 active, 1 expired)
  // =========================================================================
  console.log('📜 Creating mandates...');

  const mandate1ExpiresAt = new Date(Date.now() + 86400000); // +24 hours
  const mandate1Signature = signMandate(intent2.id, policy1.id, mandate1ExpiresAt, agent1PrivateKey);

  const mandate1 = await prisma.mandate.create({
    data: {
      id: 'mdt_active_001',
      intent_id: intent2.id,
      policy_id: policy1.id,
      signature: mandate1Signature,
      expires_at: mandate1ExpiresAt,
      status: 'ACTIVE',
    },
  });

  const mandate2ExpiresAt = new Date(Date.now() - 3600000); // -1 hour (expired)
  const mandate2Signature = signMandate(intent3.id, policy1.id, mandate2ExpiresAt, agent1PrivateKey);

  const mandate2 = await prisma.mandate.create({
    data: {
      id: 'mdt_expired_002',
      intent_id: intent3.id,
      policy_id: policy1.id,
      signature: mandate2Signature,
      expires_at: mandate2ExpiresAt,
      status: 'EXPIRED',
    },
  });

  console.log(`✅ Created ${2} mandates`);
  console.log(`   - Mandate 1: ACTIVE (expires ${mandate1.expires_at.toISOString()})`);
  console.log(`   - Mandate 2: EXPIRED (expired ${mandate2.expires_at.toISOString()})\n`);

  // =========================================================================
  // 5. CREATE PAYMENTS (3 payments - settled, pending, failed)
  // =========================================================================
  console.log('💳 Creating payments...');

  const payment1 = await prisma.payment.create({
    data: {
      mandate_id: mandate1.id,
      provider: 'stripe',
      provider_ref: 'pi_demo_settled_12345',
      amount: 150,
      currency: 'USD',
      status: 'SETTLED',
      settled_at: new Date(),
    },
  });

  const payment2 = await prisma.payment.create({
    data: {
      mandate_id: mandate1.id,
      provider: 'cashfree',
      provider_ref: 'cf_demo_pending_67890',
      amount: 250,
      currency: 'INR',
      status: 'PENDING',
      settled_at: null,
    },
  });

  const payment3 = await prisma.payment.create({
    data: {
      mandate_id: mandate2.id,
      provider: 'stripe',
      provider_ref: 'pi_demo_failed_99999',
      amount: 500,
      currency: 'USD',
      status: 'FAILED',
      settled_at: null,
    },
  });

  console.log(`✅ Created ${3} payments`);
  console.log(`   - Payment 1: ${payment1.provider} - $${payment1.amount/100} (${payment1.status})`);
  console.log(`   - Payment 2: ${payment2.provider} - ₹${payment2.amount/100} (${payment2.status})`);
  console.log(`   - Payment 3: ${payment3.provider} - $${payment3.amount/100} (${payment3.status})\n`);

  // =========================================================================
  // 6. CREATE RECEIPTS (5 receipts with proper hash chain)
  // =========================================================================
  console.log('🧾 Creating receipts with hash chain...');

  // Receipt 1: First in chain (chain_index: 0)
  const receipt1Hash = generateReceiptHash({
    prev_hash: null,
    payment_id: payment1.id,
    mandate_id: payment1.mandate_id,
    amount: payment1.amount,
    currency: payment1.currency,
    timestamp: payment1.created_at,
  });

  const receipt1 = await prisma.receipt.create({
    data: {
      payment_id: payment1.id,
      agent_id: agent1.id,
      hash: receipt1Hash,
      prev_hash: null,
      chain_index: 0,
    },
  });

  // Receipt 2: Second in chain (chain_index: 1)
  const receipt2Hash = generateReceiptHash({
    prev_hash: receipt1.hash,
    payment_id: payment2.id,
    mandate_id: payment2.mandate_id,
    amount: payment2.amount,
    currency: payment2.currency,
    timestamp: payment2.created_at,
  });

  const receipt2 = await prisma.receipt.create({
    data: {
      payment_id: payment2.id,
      agent_id: agent1.id,
      hash: receipt2Hash,
      prev_hash: receipt1.hash,
      chain_index: 1,
    },
  });

  // Receipt 3: Third in chain (chain_index: 2)
  const receipt3Hash = generateReceiptHash({
    prev_hash: receipt2.hash,
    payment_id: payment3.id,
    mandate_id: payment3.mandate_id,
    amount: payment3.amount,
    currency: payment3.currency,
    timestamp: payment3.created_at,
  });

  const receipt3 = await prisma.receipt.create({
    data: {
      payment_id: payment3.id,
      agent_id: agent1.id,
      hash: receipt3Hash,
      prev_hash: receipt2.hash,
      chain_index: 2,
    },
  });

  // Create 2 more payments for additional receipts in the chain
  const payment4 = await prisma.payment.create({
    data: {
      mandate_id: mandate1.id,
      provider: 'stripe',
      provider_ref: 'pi_demo_settled_11111',
      amount: 99,
      currency: 'USD',
      status: 'SETTLED',
      settled_at: new Date(),
    },
  });

  const payment5 = await prisma.payment.create({
    data: {
      mandate_id: mandate1.id,
      provider: 'x402',
      provider_ref: 'x402_demo_settled_22222',
      amount: 45,
      currency: 'USD',
      status: 'SETTLED',
      settled_at: new Date(),
    },
  });

  // Receipt 4: Fourth in chain (chain_index: 3)
  const receipt4Hash = generateReceiptHash({
    prev_hash: receipt3.hash,
    payment_id: payment4.id,
    mandate_id: payment4.mandate_id,
    amount: payment4.amount,
    currency: payment4.currency,
    timestamp: payment4.created_at,
  });

  const receipt4 = await prisma.receipt.create({
    data: {
      payment_id: payment4.id,
      agent_id: agent1.id,
      hash: receipt4Hash,
      prev_hash: receipt3.hash,
      chain_index: 3,
    },
  });

  // Receipt 5: Fifth in chain (chain_index: 4)
  const receipt5Hash = generateReceiptHash({
    prev_hash: receipt4.hash,
    payment_id: payment5.id,
    mandate_id: payment5.mandate_id,
    amount: payment5.amount,
    currency: payment5.currency,
    timestamp: payment5.created_at,
  });

  await prisma.receipt.create({
    data: {
      payment_id: payment5.id,
      agent_id: agent1.id,
      hash: receipt5Hash,
      prev_hash: receipt4.hash,
      chain_index: 4,
    },
  });

  console.log(`✅ Created ${5} receipts with hash chain`);
  console.log(`   - Receipt 1: chain_index=0, prev_hash=null`);
  console.log(`   - Receipt 2: chain_index=1, prev_hash=${receipt1.hash.substring(0, 20)}...`);
  console.log(`   - Receipt 3: chain_index=2, prev_hash=${receipt2.hash.substring(0, 20)}...`);
  console.log(`   - Receipt 4: chain_index=3, prev_hash=${receipt3.hash.substring(0, 20)}...`);
  console.log(`   - Receipt 5: chain_index=4, prev_hash=${receipt4.hash.substring(0, 20)}...\n`);

  // =========================================================================
  // 7. CREATE IDEMPOTENCY RECORDS (2 records)
  // =========================================================================
  console.log('🔒 Creating idempotency records...');

  await prisma.idempotency.create({
    data: {
      route: '/purchase-intents',
      key: 'demo-idempotency-key-001',
      payload: {
        agent_id: agent1.id,
        vendor: 'acme_api',
        amount: 199,
        currency: 'USD',
        description: 'API enrichment call',
      },
      status_code: 201,
      response: {
        success: true,
        intent_id: intent1.id,
        status: 'PENDING',
      },
    },
  });

  await prisma.idempotency.create({
    data: {
      route: '/webhooks/stripe',
      key: 'evt_demo_webhook_123',
      payload: {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_demo_settled_12345',
            amount: 15000,
            currency: 'usd',
            status: 'succeeded',
          },
        },
      },
      status_code: 200,
      response: {
        received: true,
        processed: true,
        payment_id: payment1.id,
      },
    },
  });

  console.log(`✅ Created ${2} idempotency records`);
  console.log(`   - Route: /purchase-intents`);
  console.log(`   - Route: /webhooks/stripe\n`);

  // =========================================================================
  // 8. CREATE VENDOR X402 ENDPOINTS (2 records)
  // =========================================================================
  console.log('🌐 Creating vendor x402 endpoints...');

  // Generate vendor keys
  const acmeVendorPrivateKey = ed25519.utils.randomPrivateKey();
  const acmeVendorPublicKey = ed25519.getPublicKey(acmeVendorPrivateKey);
  const acmeVendorPublicKeyHex = Buffer.from(acmeVendorPublicKey).toString('hex');

  const oldVendorPrivateKey = ed25519.utils.randomPrivateKey();
  const oldVendorPublicKey = ed25519.getPublicKey(oldVendorPrivateKey);
  const oldVendorPublicKeyHex = Buffer.from(oldVendorPublicKey).toString('hex');

  await prisma.vendorX402Endpoint.create({
    data: {
      vendor: 'acme_api',
      endpoint: 'https://api.acme.com/x402/payment',
      public_key: acmeVendorPublicKeyHex,
      enabled: true,
    },
  });

  await prisma.vendorX402Endpoint.create({
    data: {
      vendor: 'old_vendor',
      endpoint: 'https://old-vendor.com/x402',
      public_key: oldVendorPublicKeyHex,
      enabled: false,
    },
  });

  console.log(`✅ Created ${2} vendor x402 endpoints`);
  console.log(`   - acme_api: enabled=true`);
  console.log(`   - old_vendor: enabled=false\n`);

  // =========================================================================
  // 9. CREATE DEVELOPERS (3 developers for marketplace)
  // =========================================================================
  console.log('👨‍💻 Creating developers...');

  const dev1 = await prisma.developer.create({
    data: {
      id: 'dev_001',
      email: 'alice@example.com',
      name: 'Alice Thompson',
      verified: true,
      stripe_account_id: 'acct_test_alice_123',
      api_key_hash: 'hash_alice_' + Buffer.from(ed25519.utils.randomPrivateKey()).toString('hex').substring(0, 32),
    },
  });

  const dev2 = await prisma.developer.create({
    data: {
      id: 'dev_002',
      email: 'bob@example.com',
      name: 'Bob Martinez',
      verified: true,
      stripe_account_id: 'acct_test_bob_456',
      api_key_hash: 'hash_bob_' + Buffer.from(ed25519.utils.randomPrivateKey()).toString('hex').substring(0, 32),
    },
  });

  const dev3 = await prisma.developer.create({
    data: {
      id: 'dev_003',
      email: 'charlie@example.com',
      name: 'Charlie Kim',
      verified: false,
    },
  });

  console.log(`✅ Created 3 developers`);
  console.log(`   - Alice Thompson (verified, Stripe connected)`);
  console.log(`   - Bob Martinez (verified, Stripe connected)`);
  console.log(`   - Charlie Kim (not verified)\n`);

  // =========================================================================
  // 10. CREATE AGENT DEFINITIONS (5 marketplace agents)
  // =========================================================================
  console.log('🤖 Creating marketplace agent definitions...');

  const agentDef1 = await prisma.agentDefinition.create({
    data: {
      id: 'agt_mkt_001',
      developer_id: dev1.id,
      status: 'approved',
      downloads: 1247,
      rating: 4.8,
      code_url: 'https://storage.example.com/agents/data-enrichment-v1.zip',
      manifest: {
        name: 'Data Enrichment Agent',
        description: 'Enriches customer data with email verification, company info, and social profiles using multiple data providers.',
        category: 'Data Processing',
        version: '1.2.0',
        author: 'Alice Thompson',
        pricing: {
          model: 'per_execution',
          price_per_execution: 25,
          currency: 'USD',
        },
        capabilities: ['email-verification', 'company-lookup', 'social-profiles'],
        input_schema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            company_name: { type: 'string' },
          },
          required: ['email'],
        },
        output_schema: {
          type: 'object',
          properties: {
            verified: { type: 'boolean' },
            company: { type: 'object' },
            social_profiles: { type: 'array' },
          },
        },
        tags: ['data', 'enrichment', 'crm', 'verification'],
      },
    },
  });

  const agentDef2 = await prisma.agentDefinition.create({
    data: {
      id: 'agt_mkt_002',
      developer_id: dev1.id,
      status: 'approved',
      downloads: 856,
      rating: 4.6,
      code_url: 'https://storage.example.com/agents/sentiment-analyzer-v2.zip',
      manifest: {
        name: 'Sentiment Analyzer',
        description: 'Advanced NLP-based sentiment analysis for customer feedback, reviews, and social media content with emotion detection.',
        category: 'NLP',
        version: '2.0.1',
        author: 'Alice Thompson',
        pricing: {
          model: 'per_execution',
          price_per_execution: 15,
          currency: 'USD',
        },
        capabilities: ['sentiment-analysis', 'emotion-detection', 'language-detection'],
        input_schema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            language: { type: 'string' },
          },
          required: ['text'],
        },
        output_schema: {
          type: 'object',
          properties: {
            sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
            score: { type: 'number' },
            emotions: { type: 'array' },
          },
        },
        tags: ['nlp', 'sentiment', 'analysis', 'ai'],
      },
    },
  });

  const agentDef3 = await prisma.agentDefinition.create({
    data: {
      id: 'agt_mkt_003',
      developer_id: dev2.id,
      status: 'approved',
      downloads: 2103,
      rating: 4.9,
      code_url: 'https://storage.example.com/agents/image-optimizer-v1.zip',
      manifest: {
        name: 'Smart Image Optimizer',
        description: 'AI-powered image optimization with automatic format conversion, compression, and quality enhancement for web and mobile.',
        category: 'Media Processing',
        version: '1.5.0',
        author: 'Bob Martinez',
        pricing: {
          model: 'per_execution',
          price_per_execution: 10,
          currency: 'USD',
        },
        capabilities: ['image-compression', 'format-conversion', 'quality-enhancement', 'resize'],
        input_schema: {
          type: 'object',
          properties: {
            image_url: { type: 'string', format: 'uri' },
            target_format: { type: 'string', enum: ['webp', 'jpg', 'png', 'avif'] },
            max_width: { type: 'number' },
          },
          required: ['image_url'],
        },
        output_schema: {
          type: 'object',
          properties: {
            optimized_url: { type: 'string' },
            size_reduction: { type: 'number' },
            dimensions: { type: 'object' },
          },
        },
        tags: ['image', 'optimization', 'media', 'compression'],
      },
    },
  });

  const agentDef4 = await prisma.agentDefinition.create({
    data: {
      id: 'agt_mkt_004',
      developer_id: dev2.id,
      status: 'approved',
      downloads: 445,
      rating: 4.3,
      code_url: 'https://storage.example.com/agents/invoice-extractor-v1.zip',
      manifest: {
        name: 'Invoice Data Extractor',
        description: 'Extract structured data from invoices and receipts using OCR and machine learning. Supports multiple formats and languages.',
        category: 'Document Processing',
        version: '1.0.2',
        author: 'Bob Martinez',
        pricing: {
          model: 'per_execution',
          price_per_execution: 50,
          currency: 'USD',
        },
        capabilities: ['ocr', 'data-extraction', 'invoice-parsing', 'receipt-parsing'],
        input_schema: {
          type: 'object',
          properties: {
            document_url: { type: 'string', format: 'uri' },
            document_type: { type: 'string', enum: ['invoice', 'receipt'] },
          },
          required: ['document_url'],
        },
        output_schema: {
          type: 'object',
          properties: {
            vendor: { type: 'string' },
            total: { type: 'number' },
            line_items: { type: 'array' },
            date: { type: 'string' },
          },
        },
        tags: ['ocr', 'invoice', 'document', 'extraction'],
      },
    },
  });

  const agentDef5 = await prisma.agentDefinition.create({
    data: {
      id: 'agt_mkt_005',
      developer_id: dev3.id,
      status: 'pending_review',
      downloads: 0,
      code_url: 'https://storage.example.com/agents/spam-detector-v1.zip',
      manifest: {
        name: 'Spam Detector Pro',
        description: 'Machine learning-based spam detection for emails and messages with real-time threat analysis.',
        category: 'Security',
        version: '0.9.0',
        author: 'Charlie Kim',
        pricing: {
          model: 'per_execution',
          price_per_execution: 5,
          currency: 'USD',
        },
        capabilities: ['spam-detection', 'threat-analysis', 'phishing-detection'],
        input_schema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            sender: { type: 'string' },
          },
          required: ['message'],
        },
        output_schema: {
          type: 'object',
          properties: {
            is_spam: { type: 'boolean' },
            confidence: { type: 'number' },
            threats: { type: 'array' },
          },
        },
        tags: ['security', 'spam', 'detection', 'email'],
      },
    },
  });

  console.log(`✅ Created 5 agent definitions`);
  console.log(`   - Data Enrichment Agent (approved, 1247 downloads, 4.8★)`);
  console.log(`   - Sentiment Analyzer (approved, 856 downloads, 4.6★)`);
  console.log(`   - Smart Image Optimizer (approved, 2103 downloads, 4.9★)`);
  console.log(`   - Invoice Data Extractor (approved, 445 downloads, 4.3★)`);
  console.log(`   - Spam Detector Pro (pending review, 0 downloads)\n`);

  // =========================================================================
  // 11. CREATE AGENT VERSIONS (example versions for agent 1)
  // =========================================================================
  console.log('📦 Creating agent versions...');

  await prisma.agentVersion.create({
    data: {
      agent_id: agentDef1.id,
      version: '1.2.0',
      status: 'active',
      code_url: 'https://storage.example.com/agents/data-enrichment-v1.2.0.zip',
      changelog: 'Added LinkedIn profile enrichment; Fixed email verification API timeout issues',
      manifest: agentDef1.manifest,
    },
  });

  await prisma.agentVersion.create({
    data: {
      agent_id: agentDef1.id,
      version: '1.1.0',
      status: 'deprecated',
      code_url: 'https://storage.example.com/agents/data-enrichment-v1.1.0.zip',
      changelog: 'Initial release with email and company lookup',
      manifest: agentDef1.manifest,
    },
  });

  console.log(`✅ Created 2 agent versions for Data Enrichment Agent\n`);

  // =========================================================================
  // VERIFICATION: Verify hash chain integrity
  // =========================================================================
  console.log('🔍 Verifying receipt hash chain...');

  const receipts = await prisma.receipt.findMany({
    where: { agent_id: agent1.id },
    orderBy: { chain_index: 'asc' },
    include: { payment: true },
  });

  let chainValid = true;
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];
    if (!receipt) {
      console.error(`❌ Receipt at index ${i} is undefined`);
      chainValid = false;
      break;
    }

    // Verify hash is correct
    const expectedHash = generateReceiptHash({
      prev_hash: receipt.prev_hash,
      payment_id: receipt.payment_id,
      mandate_id: receipt.payment.mandate_id,
      amount: receipt.payment.amount,
      currency: receipt.payment.currency,
      timestamp: receipt.payment.created_at,
    });

    if (receipt.hash !== expectedHash) {
      console.error(`❌ Hash mismatch at index ${i}`);
      chainValid = false;
      break;
    }

    // Verify chain linkage
    if (i > 0) {
      const prevReceipt = receipts[i - 1];
      if (!prevReceipt) {
        console.error(`❌ Previous receipt at index ${i - 1} is undefined`);
        chainValid = false;
        break;
      }
      if (receipt.prev_hash !== prevReceipt.hash) {
        console.error(`❌ Chain broken at index ${i}`);
        chainValid = false;
        break;
      }
    } else {
      if (receipt.prev_hash !== null) {
        console.error(`❌ First receipt should have null prev_hash`);
        chainValid = false;
        break;
      }
    }
  }

  if (chainValid) {
    console.log(`✅ Hash chain verified: ${receipts.length} receipts linked correctly\n`);
  } else {
    console.error(`❌ Hash chain verification failed\n`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('═'.repeat(70));
  console.log('✅ DATABASE SEEDED SUCCESSFULLY!');
  console.log('═'.repeat(70));
  console.log(`
📊 SUMMARY - PAYMENT GATEWAY:
   - Agents:              3 (1 LOW, 1 MEDIUM, 1 HIGH risk)
   - Policies:            3 (1 active, 1 active, 1 expired)
   - Purchase Intents:    5 (1 pending, 1 approved, 1 executed, 1 rejected, 1 x402)
   - Mandates:            2 (1 active, 1 expired)
   - Payments:            5 (3 settled, 1 pending, 1 failed)
   - Receipts:            5 (hash chain verified ✓)
   - Idempotency Records: 2
   - X402 Endpoints:      2 (1 enabled, 1 disabled)

📊 SUMMARY - MARKETPLACE:
   - Developers:          3 (2 verified, 1 pending)
   - Agent Definitions:   5 (4 approved, 1 pending review)
   - Agent Versions:      2 (for Data Enrichment Agent)
   - Total Downloads:     4,651
   - Avg Rating:          4.65★

🔑 TEST AGENT IDs:
   - agt_demo_001       (LOW risk, active)
   - agt_research_002   (MEDIUM risk, active)
   - agt_suspended_003  (HIGH risk, suspended)

🔐 CRYPTOGRAPHIC KEYS GENERATED:
   - 3 agent Ed25519 key pairs
   - 2 vendor Ed25519 key pairs
   - All mandates signed with valid signatures
   - All receipts hashed and chained correctly

📋 NEXT STEPS:
   1. Verify data: npm run studio
   2. Test API endpoints with seeded data
   3. Run integration tests
   4. Query hash chain: see verification query below
  `);

  console.log('═'.repeat(70));
  console.log('🔍 HASH CHAIN VERIFICATION QUERY:');
  console.log('═'.repeat(70));
  console.log(`
-- Verify receipt chain integrity for agent agt_demo_001
SELECT
  r.chain_index,
  r.hash,
  r.prev_hash,
  p.amount,
  p.currency,
  p.status,
  CASE
    WHEN r.chain_index = 0 THEN (r.prev_hash IS NULL)
    ELSE (r.prev_hash = LAG(r.hash) OVER (ORDER BY r.chain_index))
  END as chain_valid
FROM receipts r
JOIN payments p ON r.payment_id = p.id
WHERE r.agent_id = 'agt_demo_001'
ORDER BY r.chain_index;
  `);
  console.log('═'.repeat(70));
}

// ============================================================================
// EXECUTE SEED
// ============================================================================

main()
  .catch((e) => {
    console.error('\n❌ SEED FAILED:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
