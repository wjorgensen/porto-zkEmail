'use client';

import { useState } from 'react';
import { useConnect } from 'wagmi';
import { portoConnector } from '@/lib/porto';

interface LoginFlowProps {
  onComplete: () => void;
  onBack: () => void;
}

export function LoginFlow({ onComplete, onBack }: LoginFlowProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { connect, connectors } = useConnect();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Connect using Porto connector
      // This will trigger the Porto dialog for passkey authentication
      const connector = connectors.find(c => c.id === 'porto');
      
      if (!connector) {
        throw new Error('Porto connector not found');
      }

      await connect(
        { connector },
        {
          onSuccess: () => {
            console.log('Successfully connected with Porto');
            onComplete();
          },
          onError: (error) => {
            console.error('Failed to connect:', error);
            setError(error.message);
          }
        }
      );
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Welcome Back!</h2>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          Click below to authenticate with your passkey. Your browser will prompt you to use your biometric authentication or security key.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading}
        className={`w-full py-3 px-6 rounded-lg font-bold transition-colors ${
          loading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {loading ? (
          <>
            <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
            Authenticating...
          </>
        ) : (
          'Login with Passkey'
        )}
      </button>

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

      <div className="mt-8 pt-6 border-t">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">How it works:</h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Your passkey is stored on-chain in your account contract</li>
          <li>• Authentication happens via WebAuthn (biometrics/security key)</li>
          <li>• No passwords or private keys are ever stored</li>
          <li>• All transactions are signed with your passkey</li>
        </ul>
      </div>
    </div>
  );
}