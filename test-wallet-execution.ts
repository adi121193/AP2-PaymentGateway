/**
 * Test script for wallet-based agent execution
 * 
 * Usage: npm run test:wallet-execution
 */

const API_BASE = 'http://localhost:3001';

async function testWalletExecution() {
  console.log('🧪 Testing Wallet-Based Agent Execution\n');

  // Step 1: Get user wallet balance before execution
  console.log('1️⃣  Checking user wallet balance...');
  const walletResponse = await fetch(`${API_BASE}/wallet?owner_type=USER&owner_id=user_demo_001`);
  const walletData = await walletResponse.json();
  
  if (!walletData.success) {
    console.error('❌ Failed to fetch wallet:', walletData.error);
    return;
  }

  const balanceBefore = walletData.data.availableBalance / 100;
  console.log(`   ✅ User wallet balance: $${balanceBefore.toFixed(2)}\n`);

  // Step 2: Get specific agent with versions (Data Enrichment Agent)
  console.log('2️⃣  Fetching agent details...');
  const agentResponse = await fetch(`${API_BASE}/agents/agt_mkt_001`);
  const agentData = await agentResponse.json();
  
  if (!agentData.success) {
    console.error('❌ Failed to fetch agent:', agentData.error);
    return;
  }

  const agent = agentData.data;
  const pricing = agent.manifest.pricing;
  console.log(`   ✅ Agent: ${agent.manifest.name}`);
  console.log(`   💰 Price: $${pricing.amount || pricing.price_per_execution || 0}\n`);

  // Step 3: Execute agent with wallet payment
  console.log('3️⃣  Executing agent with wallet payment...');
  const executionResponse = await fetch(`${API_BASE}/agents/${agent.id}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `test-${Date.now()}`,
    },
    body: JSON.stringify({
      inputs: {
        email: 'test@example.com',
        company_name: 'Acme Corp',
      },
      payment_method: 'wallet',
      user_id: 'user_demo_001',
    }),
  });

  const executionData = await executionResponse.json();
  
  if (!executionData.success) {
    console.error('❌ Execution failed:', executionData.error);
    return;
  }

  console.log(`   ✅ Execution started: ${executionData.data.execution_id}`);
  console.log(`   ⏳ Status: ${executionData.data.status}\n`);

  // Wait for execution to complete (polling)
  console.log('4️⃣  Waiting for execution to complete...');
  let completed = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!completed && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const statusResponse = await fetch(`${API_BASE}/agents/executions/${executionData.data.execution_id}`);
    const statusData = await statusResponse.json();
    
    if (!statusData.success) {
      console.error('❌ Failed to check status:', statusData.error);
      return;
    }

    console.log(`   ⏳ Status: ${statusData.data.status} (attempt ${attempts + 1}/${maxAttempts})`);
    
    if (statusData.data.status === 'succeeded' || statusData.data.status === 'failed') {
      completed = true;
      console.log(`   ${statusData.data.status === 'succeeded' ? '✅' : '❌'} Execution ${statusData.data.status}\n`);
    }
    
    attempts++;
  }

  // Step 5: Check wallet balance after execution
  console.log('5️⃣  Checking wallet balance after execution...');
  const walletAfterResponse = await fetch(`${API_BASE}/wallet?owner_type=USER&owner_id=user_demo_001`);
  const walletAfterData = await walletAfterResponse.json();
  
  if (!walletAfterData.success) {
    console.error('❌ Failed to fetch wallet:', walletAfterData.error);
    return;
  }

  const balanceAfter = walletAfterData.data.availableBalance / 100;
  console.log(`   ✅ User wallet balance: $${balanceAfter.toFixed(2)}`);
  console.log(`   💸 Amount charged: $${(balanceBefore - balanceAfter).toFixed(2)}\n`);

  // Step 6: Check transaction history
  console.log('6️⃣  Checking transaction history...');
  const transactionsResponse = await fetch(`${API_BASE}/wallet/transactions?owner_type=USER&owner_id=user_demo_001&limit=5`);
  const transactionsData = await transactionsResponse.json();
  
  if (!transactionsData.success) {
    console.error('❌ Failed to fetch transactions:', transactionsData.error);
    return;
  }

  console.log(`   ✅ Recent transactions:`);
  transactionsData.data.transactions.slice(0, 3).forEach((tx: any) => {
    const sign = tx.direction === 'CREDIT' ? '+' : '-';
    const amount = Math.abs(tx.amount) / 100;
    console.log(`      ${sign}$${amount.toFixed(2)} - ${tx.type} (${tx.status})`);
  });

  console.log('\n✅ Wallet execution test complete!');
}

// Run the test
testWalletExecution().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
