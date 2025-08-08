import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import IthacaAccountV2ABI from '@/lib/IthacaAccountV2.abi.json';

interface Passkey {
  keyHash: string;
  key: {
    expiry: bigint;
    keyType: number;
    isSuperAdmin: boolean;
    publicKey: string;
  };
  keyId?: string;
  name?: string;
}

// KeyType enum from contract
enum KeyType {
  P256 = 0,
  WebAuthnP256 = 1,
  Secp256k1 = 2,
  External = 3
}

export function useOnChainPasskeys(accountAddress: string | undefined) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient();

  useEffect(() => {
    const fetchPasskeys = async () => {
      if (!accountAddress || !publicClient) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('Fetching passkeys for address:', accountAddress);

        // First check if the address has code (is a contract)
        const code = await publicClient.getBytecode({
          address: accountAddress as `0x${string}`
        });
        
        if (!code || code === '0x') {
          console.log('Address is not a contract or not deployed yet');
          setPasskeys([]);
          setLoading(false);
          return;
        }

        // Call getKeys() to get all keys and their hashes
        let result: [any[], string[]];
        try {
          result = await publicClient.readContract({
            address: accountAddress as `0x${string}`,
            abi: IthacaAccountV2ABI,
            functionName: 'getKeys',
          }) as [any[], string[]];
        } catch (contractError) {
          console.log('Contract may not be initialized yet or may not have getKeys function');
          // Try simpler function to check if contract is responsive
          try {
            const totalKeys = await publicClient.readContract({
              address: accountAddress as `0x${string}`,
              abi: IthacaAccountV2ABI,
              functionName: 'totalKeys',
            });
            console.log('Contract has totalKeys:', totalKeys);
          } catch {
            console.log('Contract is not responding to calls');
          }
          setPasskeys([]);
          setLoading(false);
          return;
        }

        const [keys, keyHashes] = result;
        console.log('Fetched keys:', keys);
        console.log('Fetched keyHashes:', keyHashes);

        // Fetch keyIds for each keyHash
        const passkeyPromises = keys.map(async (key, index) => {
          const keyHash = keyHashes[index];
          
          // Try to get the keyId for this keyHash
          let keyId: string | undefined;
          try {
            keyId = await publicClient.readContract({
              address: accountAddress as `0x${string}`,
              abi: IthacaAccountV2ABI,
              functionName: 'getKeyId',
              args: [keyHash],
            }) as string;
          } catch (e) {
            // If getKeyId fails, it might not be available
            console.log('Could not fetch keyId for', keyHash);
          }

          return {
            keyHash,
            key: {
              expiry: BigInt(key.expiry || 0),
              keyType: key.keyType,
              isSuperAdmin: key.isSuperAdmin,
              publicKey: key.publicKey,
            },
            keyId,
            name: generateDeviceName(keyId || keyHash),
          };
        });

        const fetchedPasskeys = await Promise.all(passkeyPromises);
        console.log('All fetched passkeys:', fetchedPasskeys);
        
        // Filter to only show WebAuthn passkeys (type 1)
        const webAuthnPasskeys = fetchedPasskeys.filter(
          p => p.key.keyType === KeyType.WebAuthnP256
        );
        console.log('Filtered WebAuthn passkeys:', webAuthnPasskeys);
        
        setPasskeys(webAuthnPasskeys);
      } catch (err) {
        console.error('Failed to fetch passkeys:', err);
        setError('Failed to load passkeys from contract');
      } finally {
        setLoading(false);
      }
    };

    fetchPasskeys();
  }, [accountAddress, publicClient]);

  const generateDeviceName = (keyId: string): string => {
    // Generate a friendly name based on the key ID
    if (!keyId || keyId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return 'Passkey';
    }
    // Use last 8 chars of keyId for a short identifier
    const shortId = keyId.slice(-8);
    return `Passkey ${shortId}`;
  };

  return { passkeys, loading, error };
}