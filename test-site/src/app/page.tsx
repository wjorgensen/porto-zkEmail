'use client';

import { useState, useEffect } from 'react';
import { PortoSignupFlow } from '@/components/PortoSignupFlow';
import { Dashboard } from '@/components/Dashboard';

export default function Home() {
  const [portoAccount, setPortoAccount] = useState<string | null>(null);
  const [flow, setFlow] = useState<'signup' | 'login' | null>(null);

  // Check for existing Porto account
  useEffect(() => {
    const stored = localStorage.getItem('porto_account');
    if (stored) {
      const account = JSON.parse(stored);
      setPortoAccount(account.address);
    }
  }, []);

  if (portoAccount) {
    return <Dashboard accountAddress={portoAccount} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-center mb-8">
          Porto zkEmail Demo
        </h1>

        {!flow ? (
          <div className="text-center">
            <p className="mb-6 text-gray-600">
              Create a smart account with just your email - no MetaMask needed!
            </p>
            <div className="bg-blue-50 p-6 rounded-lg mb-6">
              <h3 className="font-semibold mb-2">How Porto Works:</h3>
              <ol className="text-sm text-gray-700 text-left space-y-1">
                <li>1. Enter your email address</li>
                <li>2. Verify via email reply</li>
                <li>3. Create a passkey (biometric)</li>
                <li>4. Account deployed with gas sponsorship</li>
                <li>5. Private key thrown away - passkey only!</li>
              </ol>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setFlow('signup')}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-lg"
              >
                Create Account
              </button>
              <button
                onClick={() => setFlow('login')}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-3 px-8 rounded-lg"
                disabled
              >
                Log In (Coming Soon)
              </button>
            </div>
          </div>
        ) : (
          <div>
            {flow === 'signup' && (
              <PortoSignupFlow
                onComplete={(account) => setPortoAccount(account)}
              />
            )}
            
            <button
              onClick={() => setFlow(null)}
              className="mt-8 text-gray-500 hover:text-gray-600 text-sm underline block mx-auto"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </main>
  );
}