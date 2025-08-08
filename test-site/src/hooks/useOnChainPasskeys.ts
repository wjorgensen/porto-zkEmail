import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import IthacaAccountV2ABI from '@/lib/IthacaAccountV2.abi.json';

interface Passkey {
  keyHash: string;
  key: {
    expiry: bigint;
    kty: string;
    alg: string;
    crv?: string;
    x?: string;
    y?: string;
    n?: string;
    e?: string;
  };
  keyId?: string;
  name?: string;
}

export function useOnChainPasskeys(accountAddress: string | undefined) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!accountAddress || !publicClient) {
      setLoading(false);
      return;
    }

    const fetchPasskeys = async () => {
      try {
        setLoading(true);
        setError(null);

        // Call getKeys() on the account contract
        const result = await publicClient.readContract({
          address: accountAddress as `0x${string}`,
          abi: IthacaAccountV2ABI,
          functionName: 'getKeys',
        });

        // Result is a tuple of [keys[], keyHashes[]]
        const [keys, keyHashes] = result as [any[], string[]];

        // Transform the data
        const formattedPasskeys: Passkey[] = keys.map((key, index) => ({
          keyHash: keyHashes[index],
          key: {
            expiry: key.expiry,
            kty: key.kty,
            alg: key.alg,
            crv: key.crv,
            x: key.x,
            y: key.y,
            n: key.n,
            e: key.e,
          }
        }));

        // For each passkey, try to get its device ID
        const passkeysWithIds = await Promise.all(
          formattedPasskeys.map(async (pk) => {
            try {
              const keyId = await publicClient.readContract({
                address: accountAddress as `0x${string}`,
                abi: IthacaAccountV2ABI,
                functionName: 'getKeyId',
                args: [pk.keyHash],
              });
              
              return {
                ...pk,
                keyId: keyId as string,
                name: generateDeviceName(keyId as string),
              };
            } catch {
              return pk;
            }
          })
        );

        setPasskeys(passkeysWithIds);
      } catch (err) {
        console.error('Failed to fetch passkeys:', err);
        setError('Failed to load passkeys from contract');
        setPasskeys([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPasskeys();
  }, [accountAddress, publicClient]);

  const generateDeviceName = (keyId: string): string => {
    // Generate a friendly name based on the key ID
    if (!keyId || keyId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return 'Unknown Device';
    }
    // Use last 8 chars of keyId for a short identifier
    const shortId = keyId.slice(-8);
    return `Device ${shortId}`;
  };

  return { passkeys, loading, error };
}