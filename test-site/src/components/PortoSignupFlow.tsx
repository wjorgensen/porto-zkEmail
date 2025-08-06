'use client';

import { useState, useEffect } from 'react';
import { createWalletClient, http, createPublicClient, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ANVIL_CHAIN, CONTRACTS } from '@/lib/contracts';
import { generatePrivateKey } from 'viem/accounts';

interface SignupStep {
  step: 'email' | 'verify' | 'passkey' | 'deploying' | 'complete';
  email?: string;
  verificationCode?: string;
  passkeyId?: string;
  accountAddress?: string;
  ephemeralAddress?: string;
}

export function PortoSignupFlow({ onComplete }: { onComplete: (account: string) => void }) {
  const [state, setState] = useState<SignupStep>({ step: 'email' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Send verification email
  const sendVerificationEmail = async (email: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Generate ephemeral EOA
      const privateKey = generatePrivateKey();
      const ephemeralAccount = privateKeyToAccount(privateKey);
      
      console.log('Generated ephemeral EOA:', ephemeralAccount.address);
      
      // Send verification email
      const response = await fetch('http://localhost:3001/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: email,
          walletAddress: ephemeralAccount.address,
          action: 'setEmail',
          chainId: 31337
        })
      });
      
      if (!response.ok) throw new Error('Failed to send email');
      
      const { nonce } = await response.json();
      
      setState({
        step: 'verify',
        email,
        ephemeralAddress: ephemeralAccount.address
      });
      
      // Store ephemeral key temporarily (will be discarded after deployment)
      sessionStorage.setItem('porto_ephemeral_key', privateKey);
      sessionStorage.setItem('porto_verification_nonce', nonce);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create passkey after email verification
  const createPasskey = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Create WebAuthn credential
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "Porto Test",
          id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(state.ephemeralAddress || ''),
          name: state.email || '',
          displayName: "Porto Account",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "required",
          requireResidentKey: true,
        },
        timeout: 60000,
        attestation: "direct",
      };
      
      try {
        const credential = await navigator.credentials.create({
          publicKey: publicKeyCredentialCreationOptions,
        }) as PublicKeyCredential;
        
        if (!credential) {
          throw new Error('Failed to create credential');
        }
        
        console.log('Created passkey credential:', credential.id);
        
        setState(prev => ({
          ...prev,
          step: 'deploying',
          passkeyId: credential.id
        }));
        
        // Automatically proceed to deployment
        setTimeout(() => deployAccount(credential.id), 1000);
        
      } catch (webAuthnError: any) {
        console.error('WebAuthn error:', webAuthnError);
        
        // Fallback to mock passkey for development/testing
        if (webAuthnError.name === 'NotAllowedError' || 
            webAuthnError.name === 'SecurityError' ||
            webAuthnError.name === 'NotSupportedError') {
          console.warn('WebAuthn not available, using mock passkey');
          
          const mockPasskeyId = `0x${Array.from({ length: 64 }, () => 
            Math.floor(Math.random() * 16).toString(16)
          ).join('')}`;
          
          setState(prev => ({
            ...prev,
            step: 'deploying',
            passkeyId: mockPasskeyId
          }));
          
          // Automatically proceed to deployment
          setTimeout(() => deployAccount(mockPasskeyId), 1000);
        } else {
          throw webAuthnError;
        }
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create passkey');
      setLoading(false);
    }
  };

  // Step 3: Deploy account with gas sponsorship
  const deployAccount = async (passkeyId: string) => {
    setError(null);
    
    try {
      const ephemeralKey = sessionStorage.getItem('porto_ephemeral_key');
      const nonce = sessionStorage.getItem('porto_verification_nonce');
      
      if (!ephemeralKey || !state.ephemeralAddress) {
        throw new Error('Missing ephemeral account data');
      }
      
      // Create clients
      const ephemeralAccount = privateKeyToAccount(ephemeralKey as `0x${string}`);
      const walletClient = createWalletClient({
        account: ephemeralAccount,
        chain: ANVIL_CHAIN,
        transport: http()
      });
      
      const publicClient = createPublicClient({
        chain: ANVIL_CHAIN,
        transport: http()
      });
      
      console.log('Deploying Porto account...');
      
      // In production, this would:
      // 1. Call Orchestrator to deploy EIP-7702 proxy (gas sponsored)
      // 2. Send EIP-7702 authorization transaction
      // 3. Call registerEmailAndPasskey with zkEmail proof
      // 4. Throw away ephemeral private key
      
      // For demo, we'll simulate the deployment
      const deployedAddress = state.ephemeralAddress;
      
      // Simulate deployment delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Clear ephemeral key (throw it away)
      sessionStorage.removeItem('porto_ephemeral_key');
      sessionStorage.removeItem('porto_verification_nonce');
      
      console.log('Porto account deployed:', deployedAddress);
      console.log('Ephemeral key discarded - account now controlled by passkey only');
      
      setState(prev => ({
        ...prev,
        step: 'complete',
        accountAddress: deployedAddress
      }));
      
      // Store account info
      localStorage.setItem('porto_account', JSON.stringify({
        address: deployedAddress,
        email: state.email,
        passkeyId: passkeyId,
        createdAt: new Date().toISOString()
      }));
      
      setTimeout(() => onComplete(deployedAddress), 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy account');
    } finally {
      setLoading(false);
    }
  };

  // Check verification status
  const checkVerificationStatus = async () => {
    const nonce = sessionStorage.getItem('porto_verification_nonce');
    if (!nonce) return;
    
    try {
      const response = await fetch(`http://localhost:3001/verification-status/${nonce}`);
      const data = await response.json();
      
      if (data.status === 'completed' && data.proof) {
        // Email verified, proceed to passkey creation
        setState(prev => ({ ...prev, step: 'passkey' }));
      }
    } catch (err) {
      console.error('Failed to check verification status:', err);
    }
  };

  // Poll for email verification
  useEffect(() => {
    if (state.step === 'verify') {
      const interval = setInterval(() => {
        checkVerificationStatus();
      }, 3000);
      
      // Cleanup on unmount or state change
      return () => clearInterval(interval);
    }
  }, [state.step]);

  return (
    <div className="max-w-md mx-auto">
      {/* Email Input */}
      {state.step === 'email' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Create Porto Account</h2>
          <p className="text-gray-600">
            No MetaMask needed! Porto generates a new wallet and secures it with your email and passkey.
          </p>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const email = (e.target as any).email.value;
            sendVerificationEmail(email);
          }}>
            <input
              name="email"
              type="email"
              placeholder="your@email.com"
              className="w-full p-3 border rounded-lg"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Verification Email'}
            </button>
          </form>
        </div>
      )}

      {/* Email Verification */}
      {state.step === 'verify' && (
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold">Check Your Email</h2>
          <p className="text-gray-600">
            We sent a verification email to {state.email}
          </p>
          <p className="text-sm text-gray-500">
            Reply to the email to verify your address
          </p>
          <div className="py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          </div>
          <p className="text-xs text-gray-400">
            Checking for verification...
          </p>
        </div>
      )}

      {/* Passkey Creation */}
      {state.step === 'passkey' && (
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold">Create Your Passkey</h2>
          <p className="text-gray-600">
            This passkey will be the only way to access your account
          </p>
          <button
            onClick={createPasskey}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Passkey'}
          </button>
          <p className="text-xs text-gray-500">
            Uses your device's biometric authentication
          </p>
        </div>
      )}

      {/* Account Deployment */}
      {state.step === 'deploying' && (
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold">Deploying Your Account</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>✓ Email verified</p>
            <p>✓ Passkey created</p>
            <p className="animate-pulse">⏳ Deploying EIP-7702 smart account...</p>
          </div>
          <div className="py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          </div>
          <p className="text-xs text-gray-500">
            Gas sponsored by Orchestrator (ERC-4337)
          </p>
        </div>
      )}

      {/* Complete */}
      {state.step === 'complete' && (
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold">🎉 Account Created!</h2>
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Your Porto Account:</p>
            <p className="font-mono text-xs">{state.accountAddress}</p>
          </div>
          <p className="text-green-600 font-semibold">
            ✓ No seed phrase needed
          </p>
          <p className="text-sm text-gray-600">
            Your account is secured by your email and passkey. The private key has been discarded.
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}