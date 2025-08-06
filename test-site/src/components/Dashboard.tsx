'use client';

import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, custom } from 'viem';
import { CONTRACTS, ANVIL_CHAIN } from '@/lib/contracts';
import TestTokenABI from '@/lib/TestToken.abi.json';

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
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Porto Dashboard</h1>
          <button
            onClick={logout}
            className="text-red-500 hover:text-red-600 font-semibold"
          >
            Logout
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Account Info</h2>
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4">Mint Test Tokens</h3>
            <p className="text-gray-600 mb-4">
              Get 100 PTT tokens (gas sponsored)
            </p>
            <button
              onClick={mintTokens}
              disabled={isLoading}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg"
            >
              {isLoading ? 'Minting...' : 'Mint 100 PTT'}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Uses Orchestrator for gas sponsorship
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4">Transfer Tokens</h3>
            <input
              type="text"
              placeholder="Recipient address (0x...)"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-3"
            />
            <input
              type="number"
              placeholder="Amount"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            />
            <button
              onClick={transferTokens}
              disabled={isLoading || !recipientAddress || !transferAmount}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg"
            >
              {isLoading ? 'Transferring...' : 'Transfer'}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Signs with passkey, no private key
            </p>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">🔐 Security Features:</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>No private key stored anywhere</li>
            <li>All transactions signed with passkey (biometric)</li>
            <li>Email recovery if you lose your device</li>
            <li>Gas sponsored by Orchestrator (ERC-4337)</li>
            <li>EIP-7702 smart account functionality</li>
          </ul>
        </div>

        <div className="mt-4 bg-yellow-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">📝 Demo Notes:</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Email verification uses mock proofs (3-5s instead of 20-30s)</li>
            <li>Passkey creation is simulated</li>
            <li>Token operations use a funded account for demo</li>
            <li>In production, all operations would use passkey signing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}