'use client';

import { useState, useEffect } from 'react';
import { PortoSignupFlow } from '@/components/PortoSignupFlow';
import { LoginFlow } from '@/components/LoginFlow';
import { Dashboard } from '@/components/Dashboard';
import { Header } from '@/components/Header';

export default function Home() {
  const [portoAccount, setPortoAccount] = useState<string | null>(null);
  const [flow, setFlow] = useState<'signup' | 'login' | null>(null);

  // Check for existing Porto account - but don't auto-login
  useEffect(() => {
    // We'll still check if account exists to show appropriate UI
    // but won't automatically log them in
    const stored = localStorage.getItem('porto_account');
    if (stored) {
      // Account exists but user needs to explicitly login
      console.log('Porto account found, user can login');
    }
  }, []);

  if (portoAccount) {
    return (
      <>
        <Header />
        <Dashboard accountAddress={portoAccount} />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-3xl mx-auto">
            {!flow ? (
              <>
                {/* Hero Section */}
                <div className="text-center mb-16">
                  <div className="flex justify-center mb-8">
                    <svg width="64" height="64" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="32" height="32" rx="8" fill="#1a1a1a"/>
                      <path d="M10 12H22M10 16H18M10 20H20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  
                  <h1 className="text-5xl font-bold mb-6 text-gray-900">
                    Porto zkEmail Authentication
                  </h1>
                  
                  <p className="text-xl text-gray-600 mb-2">
                    Create a smart account using zkEmail proofs.
                  </p>
                  <p className="text-lg text-gray-500">
                    Email verification meets zero-knowledge cryptography.
                  </p>
                </div>

                {/* Demo Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-8 mb-12">
                  <div className="text-center mb-8">
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium mb-4">
                      Demo
                    </span>
                    
                    <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                      zkEmail Integration Demo
                    </h2>
                    
                    <p className="text-gray-600">
                      Verify email ownership with zero-knowledge proofs
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => setFlow('login')}
                      className="bg-sky-500 hover:bg-sky-600 text-white font-medium py-3 px-8 rounded-lg transition-colors"
                    >
                      Login
                    </button>
                    <button
                      onClick={() => setFlow('signup')}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-8 rounded-lg transition-colors"
                    >
                      Sign Up
                    </button>
                  </div>
                </div>

                {/* Feature Cards */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold mb-2 text-gray-900">zkEmail Proofs</h3>
                    <p className="text-gray-600 text-sm">
                      Cryptographic proof of email ownership without revealing content.
                    </p>
                  </div>
                  
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold mb-2 text-gray-900">Gas sponsored</h3>
                    <p className="text-gray-600 text-sm">
                      Account deployment sponsored. No need for initial ETH to get started.
                    </p>
                  </div>
                  
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold mb-2 text-gray-900">Passkey secured</h3>
                    <p className="text-gray-600 text-sm">
                      Biometric authentication. Private keys never stored, only passkeys.
                    </p>
                  </div>
                  
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <h3 className="font-semibold mb-2 text-gray-900">Developer friendly</h3>
                    <p className="text-gray-600 text-sm">
                      Works seamlessly with wagmi and viem. No code changes needed.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div>
                {flow === 'signup' && (
                  <PortoSignupFlow
                    onComplete={(account) => setPortoAccount(account)}
                  />
                )}
                
                {flow === 'login' && (
                  <LoginFlow
                    onComplete={(address) => {
                      // Account address comes from the login flow
                      setPortoAccount(address);
                    }}
                    onBack={() => setFlow(null)}
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
        </div>
      </main>
    </>
  );
}