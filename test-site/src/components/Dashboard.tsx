'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, custom } from 'viem';
import { CONTRACTS, ANVIL_CHAIN } from '@/lib/contracts';
import TestTokenABI from '@/lib/TestToken.abi.json';
import { PasskeyManager } from './PasskeyManager';

interface DashboardProps {
  accountAddress: string;
}

export function Dashboard({ accountAddress }: DashboardProps) {
  const [balance, setBalance] = useState('0');
  const [ethBalance, setEthBalance] = useState('0');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  // Create public client
  const publicClient = createPublicClient({
    chain: ANVIL_CHAIN,
    transport: http()
  });

  // Load account info
  useEffect(() => {
    const stored = localStorage.getItem('porto_account');
    if (stored) {
      setAccountInfo(JSON.parse(stored));
    }
    const email = localStorage.getItem('userEmail');
    if (email) {
      setUserEmail(email);
    }
    fetchBalances();
  }, []);

  // Fetch token and ETH balances
  const fetchBalances = async () => {
    try {
      // Fetch PTT balance
      const tokenBalance = await publicClient.readContract({
        address: CONTRACTS.testToken as `0x${string}`,
        abi: TestTokenABI,
        functionName: 'balanceOf',
        args: [accountAddress as `0x${string}`],
      });
      
      setBalance(formatEther(tokenBalance as bigint));

      // Fetch ETH balance
      const ethBal = await publicClient.getBalance({
        address: accountAddress as `0x${string}`
      });
      setEthBalance(formatEther(ethBal));
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    }
  };

  // Mint test tokens (via Orchestrator - gas sponsored)
  const mintTokens = async () => {
    setIsLoading(true);
    try {
      // In production, this would:
      // 1. Create a UserOp for minting
      // 2. Sign with passkey
      // 3. Submit via Orchestrator (gas sponsored)
      
      // For demo, we'll simulate the mint
      alert('In production, this would mint tokens via gas-sponsored transaction signed with your passkey');
      
      // Simulate mint by using a funded account
      const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const { privateKeyToAccount } = await import('viem/accounts');
      const fundedAccount = privateKeyToAccount(testPrivateKey);
      
      const walletClient = createWalletClient({
        account: fundedAccount,
        chain: ANVIL_CHAIN,
        transport: http()
      });

      const hash = await walletClient.writeContract({
        address: CONTRACTS.testToken as `0x${string}`,
        abi: TestTokenABI,
        functionName: 'mint',
        args: [accountAddress as `0x${string}`, parseEther('100')],
      });
      
      console.log('Mint transaction:', hash);
      await publicClient.waitForTransactionReceipt({ hash });
      
      await fetchBalances();
      alert('Successfully minted 100 PTT tokens!');
    } catch (error) {
      console.error('Failed to mint tokens:', error);
      alert('Failed to mint tokens. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Transfer tokens (would use passkey signing in production)
  const transferTokens = async () => {
    if (!recipientAddress || !transferAmount) return;
    
    setIsLoading(true);
    try {
      alert(`In production, this would:
1. Create UserOp for transfer
2. Sign with your passkey (biometric)
3. Submit via Orchestrator (gas sponsored)
4. No private key needed!`);
      
      setRecipientAddress('');
      setTransferAmount('');
    } catch (error) {
      console.error('Failed to transfer tokens:', error);
      alert('Failed to transfer tokens. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('porto_account');
    window.location.reload();
  };

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <button
            onClick={logout}
            className="text-gray-600 hover:text-gray-900 font-medium text-sm"
          >
            Sign out
          </button>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Account Info</h2>
          <div className="space-y-2">
            <p className="text-gray-600">
              <span className="font-semibold">Address:</span>{' '}
              <span className="font-mono text-sm">{accountAddress}</span>
            </p>
            <p className="text-gray-600">
              <span className="font-semibold">Email:</span>{' '}
              {accountInfo?.email || 'Loading...'}
            </p>
            <p className="text-gray-600">
              <span className="font-semibold">Passkey ID:</span>{' '}
              <span className="font-mono text-xs">
                {accountInfo?.passkeyId?.slice(0, 16)}...
              </span>
            </p>
            <div className="pt-4 border-t">
              <p className="text-gray-600">
                <span className="font-semibold">ETH Balance:</span>{' '}
                <span className="font-bold text-xl">{ethBalance}</span>
              </p>
              <p className="text-gray-600">
                <span className="font-semibold">PTT Balance:</span>{' '}
                <span className="font-bold text-xl text-green-600">{balance}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Mint Test Tokens</h3>
            <p className="text-gray-600 text-sm mb-4">
              Get 100 PTT tokens (gas sponsored)
            </p>
            <button
              onClick={mintTokens}
              disabled={isLoading}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-gray-400 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
            >
              {isLoading ? 'Minting...' : 'Mint 100 PTT'}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Uses Orchestrator for gas sponsorship
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Transfer Tokens</h3>
            <input
              type="text"
              placeholder="Recipient address (0x...)"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg mb-3 text-sm focus:outline-none focus:border-sky-500"
            />
            <input
              type="number"
              placeholder="Amount"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="w-full p-2.5 border border-gray-200 rounded-lg mb-4 text-sm focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={transferTokens}
              disabled={isLoading || !recipientAddress || !transferAmount}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-gray-400 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
            >
              {isLoading ? 'Transferring...' : 'Transfer'}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Signs with passkey, no private key
            </p>
          </div>
        </div>

        <div className="mt-8">
          <PasskeyManager accountAddress={accountAddress} />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Security Features</h3>
            </div>
            <ul className="text-gray-600 text-sm space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>No private key stored anywhere</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>All transactions signed with passkey</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Email recovery if you lose your device</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Gas sponsored by Orchestrator</span>
              </li>
            </ul>
          </div>

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Demo Notes</h3>
            </div>
            <ul className="text-gray-700 text-sm space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Email verification uses mock proofs</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Passkey creation is simulated</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Token operations use funded account</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}