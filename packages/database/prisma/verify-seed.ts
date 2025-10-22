/**
 * Verify Seed Data - Simple verification script to check seeded data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('🔍 Verifying seed data...\n');

  // Count records in each table
  const agentCount = await prisma.agent.count();
  const policyCount = await prisma.policy.count();
  const intentCount = await prisma.purchaseIntent.count();
  const mandateCount = await prisma.mandate.count();
  const paymentCount = await prisma.payment.count();
  const receiptCount = await prisma.receipt.count();
  const idempotencyCount = await prisma.idempotency.count();
  const vendorCount = await prisma.vendorX402Endpoint.count();

  console.log('📊 Record Counts:');
  console.log(`   - Agents:              ${agentCount}`);
  console.log(`   - Policies:            ${policyCount}`);
  console.log(`   - Purchase Intents:    ${intentCount}`);
  console.log(`   - Mandates:            ${mandateCount}`);
  console.log(`   - Payments:            ${paymentCount}`);
  console.log(`   - Receipts:            ${receiptCount}`);
  console.log(`   - Idempotency Records: ${idempotencyCount}`);
  console.log(`   - X402 Endpoints:      ${vendorCount}\n`);

  // Show agents
  const agents = await prisma.agent.findMany({
    select: {
      id: true,
      name: true,
      risk_tier: true,
      status: true,
    },
  });

  console.log('👤 Agents:');
  agents.forEach((a) => {
    console.log(`   - ${a.id}: ${a.name} (${a.risk_tier}, ${a.status})`);
  });
  console.log();

  // Show receipt chain
  const receipts = await prisma.receipt.findMany({
    where: { agent_id: 'agt_demo_001' },
    orderBy: { chain_index: 'asc' },
    include: { payment: true },
  });

  console.log('🧾 Receipt Chain (agt_demo_001):');
  receipts.forEach((r) => {
    const prevHashShort = r.prev_hash ? r.prev_hash.substring(0, 20) + '...' : 'null';
    const hashShort = r.hash.substring(0, 20) + '...';
    console.log(
      `   [${r.chain_index}] ${hashShort} ← ${prevHashShort} | $${r.payment.amount/100} ${r.payment.status}`
    );
  });
  console.log();

  console.log('✅ Verification complete!');
}

verify()
  .catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
