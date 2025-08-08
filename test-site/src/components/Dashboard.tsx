'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, custom } from 'viem';
import { CONTRACTS, ANVIL_CHAIN } from '@/lib/contracts';
import { PasskeyManager } from './PasskeyManager';
import IthacaAccountV2ABI from '@/lib/IthacaAccountV2.abi.json';

interface DashboardProps {
  accountAddress: string;
}

export function Dashboard({ accountAddress }: DashboardProps) {
  const [ethBalance, setEthBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [emailHash, setEmailHash] = useState<string>('');

  // Create public client
  const publicClient = createPublicClient({
    chain: ANVIL_CHAIN,
    transport: http()
  });

  // Load account info from chain
  useEffect(() => {
    fetchAccountData();
    fetchEthBalance();
  }, [accountAddress]);
  
  // Fetch account data from chain
  const fetchAccountData = async () => {
    try {
      // Check if account has email registered
      const hash = await publicClient.readContract({
        address: accountAddress as `0x${string}`,
        abi: IthacaAccountV2ABI,
        functionName: 'getEmailHash',
      }) as string;
      
      if (hash && hash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        setEmailHash(hash);
      }
    } catch (error) {
      console.log('Could not fetch email hash:', error);
    }
  };

  // Fetch ETH balance
  const fetchEthBalance = async () => {
    try {
      const ethBal = await publicClient.getBalance({
        address: accountAddress as `0x${string}`
      });
      setEthBalance(formatEther(ethBal));
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };


  // Logout
  const logout = () => {
    // Just reload the page to reset state
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
            {emailHash && (
              <p className="text-gray-600">
                <span className="font-semibold">Email Hash:</span>{' '}
                <span className="font-mono text-xs">
                  {emailHash.slice(0, 10)}...
                </span>
              </p>
            )}
            <div className="pt-4 border-t">
              <p className="text-gray-600">
                <span className="font-semibold">ETH Balance:</span>{' '}
                <span className="font-bold text-xl">{ethBalance}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-1 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">Account Actions</h3>
            <p className="text-gray-600 text-sm mb-4">
              Transaction features coming soon. All transactions will be signed with your passkey.
            </p>
            <div className="space-y-3">
              <button
                disabled
                className="w-full bg-gray-200 text-gray-500 font-medium py-2.5 px-6 rounded-lg cursor-not-allowed"
              >
                Send ETH (Coming Soon)
              </button>
              <button
                disabled
                className="w-full bg-gray-200 text-gray-500 font-medium py-2.5 px-6 rounded-lg cursor-not-allowed"
              >
                Execute Transaction (Coming Soon)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              All actions will be signed with your passkey - no private key needed
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
                <span>Email verification uses real ZK proofs (Groth16)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Passkeys use real WebAuthn API (Touch ID/Face ID)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Running on local Anvil testnet</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}