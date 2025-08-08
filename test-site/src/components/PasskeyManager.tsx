'use client';

import { useState } from 'react';
import { useOnChainPasskeys } from '@/hooks/useOnChainPasskeys';
import { useAccount, useWalletClient } from 'wagmi';

interface PasskeyManagerProps {
  accountAddress?: string;
}

export function PasskeyManager({ accountAddress }: PasskeyManagerProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const targetAddress = accountAddress || address;
  const { passkeys, loading, error } = useOnChainPasskeys(targetAddress);
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevoke = async (keyHash: string) => {
    if (!walletClient) {
      alert('Please connect your wallet first');
      return;
    }

    if (!confirm('Are you sure you want to revoke this passkey?')) {
      return;
    }

    if (passkeys.length <= 1) {
      alert('Cannot revoke the last passkey. You need at least one passkey to access your account.');
      return;
    }

    setRevoking(keyHash);
    try {
      // In production, this would call the revokePasskey function on the contract
      // For now, we'll show a placeholder
      alert('Passkey revocation would be processed on-chain. This requires signing with another passkey.');
      
      // TODO: Implement actual on-chain revocation
      // const tx = await walletClient.writeContract({
      //   address: targetAddress as `0x${string}`,
      //   abi: IthacaAccountV2ABI,
      //   functionName: 'revokePasskey',
      //   args: [keyHash, signature],
      // });
    } catch (error) {
      console.error('Failed to revoke passkey:', error);
      alert(`Failed to revoke passkey: ${error.message}`);
    } finally {
      setRevoking(null);
    }
  };

  const handleAddPasskey = () => {
    alert('To add a new passkey, you need to go through the email verification flow again. Each passkey must be verified.');
    // In production, this would trigger the email verification + passkey registration flow
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">On-Chain Passkeys</h3>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading passkeys from contract...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">On-Chain Passkeys</h3>
        <div className="text-center py-4 text-red-600">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">On-Chain Passkeys</h3>
        <button
          onClick={handleAddPasskey}
          className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
        >
          Add Passkey
        </button>
      </div>

      {passkeys.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No passkeys registered yet.</p>
      ) : (
        <div className="space-y-3">
          {passkeys.map((passkey) => (
            <div key={passkey.keyHash} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium">{passkey.name || 'Unnamed Passkey'}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Key Hash: {passkey.keyHash.slice(0, 10)}...
                  </p>
                  <p className="text-sm text-gray-500">
                    Type: {passkey.key.kty} / {passkey.key.alg}
                  </p>
                  {passkey.key.expiry && passkey.key.expiry > 0n && (
                    <p className="text-sm text-gray-500">
                      Expires: {new Date(Number(passkey.key.expiry) * 1000).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRevoke(passkey.keyHash)}
                  disabled={revoking === passkey.keyHash || passkeys.length === 1}
                  className={`text-sm px-3 py-1 rounded ${
                    revoking === passkey.keyHash || passkeys.length === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {revoking === passkey.keyHash ? 'Revoking...' : 'Revoke'}
                </button>
              </div>
              {passkeys.length === 1 && (
                <p className="text-xs text-orange-600 mt-2">
                  This is your only passkey. You cannot revoke it.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-gray-500">
          Passkeys are stored on-chain in your account's storage. Each passkey can sign transactions.
          {passkeys.length > 0 && ` You have ${passkeys.length} passkey${passkeys.length > 1 ? 's' : ''} registered on-chain.`}
        </p>
      </div>
    </div>
  );
}