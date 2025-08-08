'use client';

import { useState } from 'react';
import { createWalletClient, createPublicClient, http, custom } from 'viem';
import { ANVIL_CHAIN, CONTRACTS } from '@/lib/contracts';

interface LoginFlowProps {
  onComplete: (address: string) => void;
  onBack: () => void;
}

interface StoredAccount {
  address: string;
  email: string;
  passkeyId: string;
  createdAt: string;
}

export function LoginFlow({ onComplete, onBack }: LoginFlowProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  
  // For demo, we use the proxy account address
  // In production, would query chain for available accounts
  const demoAccount: StoredAccount = {
    address: CONTRACTS.accountProxy,
    email: 'demo@porto.sh',
    passkeyId: 'demo-passkey',
    createdAt: new Date().toISOString()
  };
  const [availableAccounts] = useState<StoredAccount[]>([demoAccount]);

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get stored account info
      const storedAccount = availableAccounts[0];
      if (!storedAccount) {
        throw new Error('No account found. Please sign up first.');
      }

      console.log('Attempting passkey authentication for:', storedAccount.address);

      // Create WebAuthn authentication challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // For passkey authentication, we need to either:
      // 1. Use the actual credential ID if it's stored properly
      // 2. Or don't specify allowCredentials to let the browser show all available passkeys
      
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        // Don't specify allowCredentials - let the user pick from available passkeys
        // This allows the browser to show all registered passkeys for this site
      };

      try {
        // Request passkey authentication
        const credential = await navigator.credentials.get({
          publicKey: publicKeyCredentialRequestOptions,
        }) as PublicKeyCredential;

        if (!credential) {
          throw new Error('Authentication cancelled');
        }

        console.log('Passkey authentication successful!');
        console.log('Credential ID:', credential.id);
        
        // In production, you would:
        // 1. Send the credential response to your backend
        // 2. Verify the signature on-chain or off-chain
        // 3. Generate a session token
        
        // For demo, we'll simulate successful authentication
        console.log('Logging in to account:', storedAccount.address);
        
        // Complete the login with the account address
        // All account data is on-chain
        setTimeout(() => {
          onComplete(storedAccount.address);
        }, 1000);
        
      } catch (webAuthnError: any) {
        console.error('WebAuthn error:', webAuthnError);
        
        // Handle specific WebAuthn errors
        if (webAuthnError.name === 'NotAllowedError') {
          setError('Authentication was cancelled or timed out. Please try again or use the "Skip Authentication" button for testing.');
        } else if (webAuthnError.name === 'SecurityError') {
          setError('Security error. Please ensure you are using HTTPS or localhost.');
        } else if (webAuthnError.name === 'NotSupportedError') {
          setError('Passkeys are not supported on this device or browser.');
        } else if (webAuthnError.name === 'InvalidStateError') {
          setError('Invalid authentication state. Please try again.');
        } else {
          setError('Failed to authenticate with passkey. Please try again or use the "Skip Authentication" button.');
        }
      }
      
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for adding new passkey to existing account
    setError('Adding new passkeys via email is coming soon. For now, please use your existing passkey.');
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">Welcome Back!</h2>
        
        {/* Passkey Login Section */}
        <div className="mb-6">
          <button
            onClick={handlePasskeyLogin}
            disabled={loading || availableAccounts.length === 0}
            className={`w-full py-3 px-6 rounded-lg font-bold transition-colors ${
              loading || availableAccounts.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {loading ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Authenticating...
              </>
            ) : availableAccounts.length === 0 ? (
              'No Account Found - Please Sign Up'
            ) : (
              'Login with Passkey'
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or add a new passkey</span>
          </div>
        </div>

        {/* Email Section for Adding New Passkey */}
        <div>
          <form onSubmit={handleEmailSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add a new passkey to your existing account
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Add New Passkey (Coming Soon)
            </button>
          </form>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">How it works:</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Your passkey is stored on-chain in your account contract</li>
            <li>• Authentication happens via WebAuthn (biometrics/security key)</li>
            <li>• No passwords or private keys are ever stored</li>
            <li>• All transactions are signed with your passkey</li>
          </ul>
        </div>

        {/* Navigation */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm mb-2">
            Don't have an account yet?
          </p>
          <button
            onClick={onBack}
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            Sign up instead
          </button>
        </div>
      </div>
    </div>
  );
}