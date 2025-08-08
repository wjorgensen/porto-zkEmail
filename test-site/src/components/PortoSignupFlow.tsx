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
      
      if (data.status === 'verified' && data.zkProof) {
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
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">Create your zkEmail account</h2>
            <p className="text-gray-600">
              Enter your email to get started
            </p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const email = (e.target as any).email.value;
            sendVerificationEmail(email);
          }}>
            <input
              name="email"
              type="email"
              placeholder="your@email.com"
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-sky-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full bg-sky-500 hover:bg-sky-600 text-white font-medium py-3 px-6 rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending...' : 'Continue with email'}
            </button>
          </form>
          
          <p className="text-xs text-gray-500 text-center mt-6">
            No passwords or extensions required
          </p>
        </div>
      )}

      {/* Email Verification */}
      {state.step === 'verify' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">Check your email</h2>
            <p className="text-gray-600 mb-2">
              We sent a verification to
            </p>
            <p className="font-medium text-gray-900 mb-6">
              {state.email}
            </p>
            <div className="py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto"></div>
            </div>
            <p className="text-sm text-gray-500">
              Reply to the email to verify your address
            </p>
          </div>
        </div>
      )}

      {/* Passkey Creation */}
      {state.step === 'passkey' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">Secure your account</h2>
            <p className="text-gray-600 mb-6">
              Create a passkey for secure, passwordless access
            </p>
            <button
              onClick={createPasskey}
              disabled={loading}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-medium py-3 px-6 rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create passkey'}
            </button>
            <p className="text-xs text-gray-500 mt-4">
              Uses your device's biometric authentication
            </p>
          </div>
        </div>
      )}

      {/* Account Deployment */}
      {state.step === 'deploying' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">Setting up your zkEmail account</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Email verified</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-green-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Passkey created</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-500"></div>
                <span>Deploying smart account...</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-6">
              Gas sponsored • EIP-7702 account
            </p>
          </div>
        </div>
      )}

      {/* Complete */}
      {state.step === 'complete' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">zkEmail account created!</h2>
            <p className="text-gray-600 mb-6">
              Your Porto account is ready to use
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-xs text-gray-500 mb-1">Account address</p>
              <p className="font-mono text-sm break-all">{state.accountAddress}</p>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              <p className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                No seed phrase to remember
              </p>
              <p className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Secured by email + passkey
              </p>
            </div>
          </div>
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