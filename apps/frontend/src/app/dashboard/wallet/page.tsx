/**
 * Wallet Dashboard Page
 * Displays wallet balance and transactions for both users and developers
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WalletCard } from '@/components/wallet/wallet-card';
import { TransactionList } from '@/components/wallet/transaction-list';
import { TopupDialog } from '@/components/wallet/topup-dialog';
import { WithdrawDialog } from '@/components/wallet/withdraw-dialog';
import { Wallet, TrendingUp, Download, Upload } from 'lucide-react';

// Demo owner IDs (in production, these would come from authentication)
const DEMO_USER_ID = 'user_demo_001';
const DEMO_DEVELOPER_ID = 'dev_001';

export default function WalletPage() {
  const [mode, setMode] = useState<'user' | 'developer'>('user');
  const [showTopup, setShowTopup] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const ownerType = mode === 'user' ? 'USER' : 'DEVELOPER';
  const ownerId = mode === 'user' ? DEMO_USER_ID : DEMO_DEVELOPER_ID;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Wallet</h1>
        <p className="text-gray-600 text-lg">
          Manage your balance and view transaction history
        </p>
      </div>

      {/* Mode Toggle */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'user' | 'developer')} className="mb-6">
        <TabsList>
          <TabsTrigger value="user" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            User Mode
          </TabsTrigger>
          <TabsTrigger value="developer" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Developer Mode
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Wallet Balance Card */}
      <div className="mb-8">
        <WalletCard ownerType={ownerType} ownerId={ownerId} />
      </div>

      {/* Actions */}
      <div className="mb-6 flex gap-4">
        {mode === 'user' && (
          <Button onClick={() => setShowTopup(true)} className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Top Up Wallet
          </Button>
        )}
        {mode === 'developer' && (
          <Button onClick={() => setShowWithdraw(true)} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Request Withdrawal
          </Button>
        )}
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            {mode === 'user' 
              ? 'View your payment history and spending on agents'
              : 'View your earnings from agent executions'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionList ownerType={ownerType} ownerId={ownerId} />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <TopupDialog
        open={showTopup}
        onOpenChange={setShowTopup}
        ownerType="USER"
        ownerId={DEMO_USER_ID}
      />
      <WithdrawDialog
        open={showWithdraw}
        onOpenChange={setShowWithdraw}
      />
    </div>
  );
}
