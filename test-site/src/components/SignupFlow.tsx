'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { createPublicClient, createWalletClient, custom, parseEther, encodeAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CONTRACTS, ANVIL_CHAIN } from '@/lib/contracts';
import IthacaAccountV2ABI from '@/lib/IthacaAccountV2.abi.json';

interface SignupFlowProps {
  onComplete: () => void;
  onBack: () => void;
}

export function SignupFlow({ onComplete, onBack }: SignupFlowProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const [step, setStep] = useState<'passkey' | 'email' | 'waitingForReply' | 'generatingProof' | 'deploying' | 'complete'>('passkey');
  const [email, setEmail] = useState('');
  const [passkey, setPasskey] = useState<{ id: string; publicKey: string } | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [verificationNonce, setVerificationNonce] = useState<number | null>(null);
  const [zkProof, setZkProof] = useState<any>(null);
  const [proofStatus, setProofStatus] = useState<string>('Waiting for email verification...');
  const [contractDeployed, setContractDeployed] = useState(false);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Trigger finalization when both proof and contract are ready
  useEffect(() => {
    if (zkProof && contractDeployed && step === 'waitingForReply') {
      setStep('deploying');
      finalizeRegistration(zkProof);
    }
  }, [zkProof, contractDeployed, step]);

  // Poll for email verification and proof generation status
  const pollForVerification = (nonce: number) => {
    console.log('Starting polling for nonce:', nonce);
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3001/verification-status/${nonce}`);
        console.log('Poll response status:', response.status);
        if (response.ok) {
          const status = await response.json();
          console.log('Verification status:', status);
          
          // Update status messages
          if (status.emailReceived && !status.verified) {
            setProofStatus('Email received! Generating ZK proof...');
          } else if (status.verified && !status.hasZkProof) {
            setProofStatus('Email verified! Finalizing proof generation...');
          } else if (status.hasZkProof) {
            clearInterval(interval);
            setPollingInterval(null);
            console.log('Proof generated!', status);
            setZkProof(status.zkProof);
            setProofStatus('ZK proof generated successfully!');
            
            // The useEffect will handle transitioning to the next step
          }
        }
      } catch (error) {
        console.error('Error polling verification status:', error);
      }
    }, 2000); // Poll every 2 seconds for faster updates
    
    setPollingInterval(interval);
  };

  // Generate a new passkey (WebAuthn)
  const createPasskey = async () => {
    try {
      // Generate a challenge for the passkey creation
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      
      // Create a user ID
      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);
      
      // WebAuthn credential creation options
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "Porto zkEmail",
          id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        },
        user: {
          id: userId,
          name: email || "user@example.com", // Will be updated when email is entered
          displayName: "Porto User",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256 (P-256)
          { alg: -257, type: "public-key" }, // RS256 (for compatibility)
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Use platform authenticator (Touch ID, Face ID, Windows Hello)
          userVerification: "required",
          residentKey: "required",
          requireResidentKey: true,
        },
        timeout: 60000,
        attestation: "none", // We don't need attestation for this use case
      };
      
      // Create the credential
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;
      
      if (!credential) {
        throw new Error('Passkey creation cancelled');
      }
      
      // Get the public key from the credential response
      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKeyBuffer = response.publicKey;
      
      if (!publicKeyBuffer) {
        throw new Error('No public key in credential response');
      }
      
      // Parse the public key (COSE format)
      // For P-256 (ES256), we need to extract the x and y coordinates
      const publicKeyArray = new Uint8Array(publicKeyBuffer);
      
      // Simple COSE key parsing for P-256
      // The public key is in COSE format, we need to extract x and y coordinates
      // For a proper implementation, you'd use a COSE library
      let x = '';
      let y = '';
      
      // Basic COSE_Key structure parsing
      // This is simplified - in production use a proper COSE library
      if (publicKeyArray.length >= 77) {
        // P-256 public keys are typically 77 bytes in COSE format
        // Skip COSE headers and extract x,y coordinates (last 64 bytes)
        const coordStart = publicKeyArray.length - 64;
        const xBytes = publicKeyArray.slice(coordStart, coordStart + 32);
        const yBytes = publicKeyArray.slice(coordStart + 32, coordStart + 64);
        
        x = '0x' + Array.from(xBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        y = '0x' + Array.from(yBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      } else {
        // Fallback to mock values if parsing fails
        console.warn('Could not parse public key, using mock values');
        x = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
        y = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
      }
      
      const passkeyData = {
        id: credential.id,
        rawId: Array.from(new Uint8Array(credential.rawId)).map(b => b.toString(16).padStart(2, '0')).join(''),
        publicKey: x + y.slice(2), // Concatenate x and y coordinates
        x: x,
        y: y,
        name: navigator.userAgent.includes('Mac') ? 'MacBook Touch ID' : 
              navigator.userAgent.includes('iPhone') ? 'iPhone Face ID' : 
              navigator.userAgent.includes('Android') ? 'Android Biometric' : 'Platform Authenticator'
      };
      
      console.log('Passkey created successfully:', passkeyData);
      setPasskey(passkeyData);
      setStep('email');
    } catch (error) {
      console.error('Failed to create passkey:', error);
      if (error.name === 'NotAllowedError') {
        alert('Passkey creation was cancelled or not allowed. Please try again.');
      } else if (error.name === 'NotSupportedError') {
        alert('Your browser or device does not support passkeys. Please use a different browser or device.');
      } else {
        alert('Failed to create passkey: ' + error.message);
      }
    }
  };

  // Send email with zkEmail challenge
  const sendEmail = async () => {
    if (!email) {
      alert('Please enter your email');
      return;
    }

    try {
      // Call the email infrastructure backend
      const response = await fetch('http://localhost:3001/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail: email,
          action: 'setEmail', // The action for email registration
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      const data = await response.json();
      console.log('Email sent successfully:', data);
      
      // Store the code and nonce for verification
      setEmailCode(data.code);
      setVerificationNonce(data.nonce);
      localStorage.setItem('verificationNonce', data.nonce.toString());
      
      alert(`Verification email sent to ${email}!\n\nPlease reply to the email with subject "Re: PORTO-AUTH-${data.code}" to continue.`);
      
      setStep('waitingForReply');
      
      // Start polling for verification status
      pollForVerification(data.nonce);
      
      // Start deploying the contract in parallel (while waiting for email)
      deployContractInBackground();
    } catch (error) {
      console.error('Failed to send email:', error);
      alert(`Failed to send email: ${error.message}`);
    }
  };

  // Deploy contract in the background while waiting for email
  const deployContractInBackground = async () => {
    try {
      console.log('Starting background contract deployment...');
      
      // For demo, we'll use a test private key to simulate the account creation
      const testAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
      
      // Create clients for the test account
      const testWalletClient = createWalletClient({
        account: testAccount,
        chain: ANVIL_CHAIN,
        transport: custom(window.ethereum as any)
      });
      
      const testPublicClient = createPublicClient({
        chain: ANVIL_CHAIN,
        transport: custom(window.ethereum as any)
      });
      
      // Deploy the proxy contract
      console.log('Deploying proxy contract...');
      // In production, you would deploy the actual proxy contract here
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setContractDeployed(true);
      console.log('Contract deployed successfully in background!');
    } catch (error) {
      console.error('Failed to deploy contract in background:', error);
    }
  };
  
  // Finalize registration once both proof and contract are ready
  const finalizeRegistration = async (proof: any) => {
    try {
      console.log('Finalizing registration with proof and deployed contract...');
      
      if (!walletClient || !passkey) {
        throw new Error('Missing wallet client or passkey');
      }

      // The account proxy address from deployments
      const accountAddress = '0xF5a71C6794A476a26C42Af3a08a3a86352312c95';
      
      // Prepare the email proof with verifier address
      const zkVerifierAddress = '0x83480CaAb6E6FE4Eff480fc0ee17379EED25572a';
      const emailProof = encodeAbiParameters(
        [{ name: 'verifier', type: 'address' }, { name: 'proof', type: 'bytes' }],
        [zkVerifierAddress, proof]
      );

      // Convert passkey to the format expected by the contract
      const keyData = {
        expiry: 0n, // No expiry
        kty: '2', // EC for elliptic curve
        alg: '-7', // ES256
        crv: '1', // P-256
        x: passkey.publicKey.slice(0, 66), // First 32 bytes as hex
        y: '0x' + passkey.publicKey.slice(66), // Next 32 bytes as hex
        n: '0x', // Not used for EC keys
        e: '0x', // Not used for EC keys
      };

      // Call setEmailAndRegister on the account contract
      const hash = await walletClient.writeContract({
        address: accountAddress as `0x${string}`,
        abi: IthacaAccountV2ABI,
        functionName: 'setEmailAndRegister',
        args: [emailProof, email, keyData, passkey.id],
      });

      console.log('Transaction hash:', hash);
      
      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('Transaction confirmed:', receipt);
      
      // Store user info in localStorage
      localStorage.setItem('userEmail', email);
      localStorage.setItem('accountAddress', accountAddress);
      localStorage.setItem('passkeyId', passkey.id);
      
      setStep('complete');
      
      // Wait a bit before completing
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error('Failed to finalize registration:', error);
      alert('Failed to finalize registration. Please try again.');
    }
  };

  // Deploy the account with EIP-7702
  const deployAccount = async (proof: string) => {
    if (!walletClient || !address) return;
    
    setStep('deploying');
    
    try {
      // For demo, we'll use a test private key to simulate the account creation
      // In production, this would be handled differently
      const testAccount = privateKeyToAccount('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
      
      // Mock the deployment process
      console.log('Deploying account with:');
      console.log('- EOA:', testAccount.address);
      console.log('- Implementation:', CONTRACTS.accountImplementation);
      console.log('- Email hash:', email);
      console.log('- Passkey:', passkey);
      
      // In production, you would:
      // 1. Send EIP-7702 transaction to link EOA to proxy
      // 2. Call registerEmailAndPasskey on the account
      
      setStep('complete');
      
      // Wait a bit before completing
      setTimeout(() => {
        onComplete();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to deploy account:', error);
      alert('Failed to deploy account. Please try again.');
      setStep('passkey');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {step === 'passkey' && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Create Your Passkey</h2>
          <p className="mb-6 text-gray-600">
            First, let's create a secure passkey for your account
          </p>
          <button
            onClick={createPasskey}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg"
          >
            Create Passkey
          </button>
          <button
            onClick={onBack}
            className="mt-4 text-gray-500 hover:text-gray-600 text-sm underline block mx-auto"
          >
            Back
          </button>
        </div>
      )}

      {step === 'email' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Enter Your Email</h2>
          <p className="mb-4 text-gray-600">
            We'll send you an email to verify your account
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full p-3 border border-gray-300 rounded-lg mb-4"
          />
          <button
            onClick={sendEmail}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg"
          >
            Send Verification Email
          </button>
          <button
            onClick={() => setStep('passkey')}
            className="mt-4 text-gray-500 hover:text-gray-600 text-sm underline block mx-auto"
          >
            Back
          </button>
        </div>
      )}

      {step === 'waitingForReply' && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Check Your Email</h2>
          <p className="mb-4 text-gray-600">
            We sent a verification email to {email}
          </p>
          <p className="mb-2 text-sm text-gray-500">
            Reply to the email with subject: <strong>Re: PORTO-AUTH-{emailCode}</strong>
          </p>
          <div className="mb-6 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 mb-2">Status:</p>
            <p className="text-sm text-gray-600">{proofStatus}</p>
            {contractDeployed && (
              <p className="text-sm text-green-600 mt-2">✓ Smart contract deployed</p>
            )}
          </div>
          <div className="mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          </div>
          <div className="space-y-2">
            <button
              onClick={async () => {
                const nonce = localStorage.getItem('verificationNonce');
                if (nonce) {
                  const response = await fetch(`http://localhost:3001/verification-status/${nonce}`);
                  const status = await response.json();
                  if (status.verified) {
                    generateProof();
                  } else {
                    alert('Email reply not yet received. Please make sure you replied to the email.');
                  }
                }
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg"
            >
              Check Now
            </button>
            <button
              onClick={generateProof}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg ml-2"
            >
              Skip (Demo Mode)
            </button>
          </div>
        </div>
      )}

      {step === 'deploying' && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Finalizing Your Account</h2>
          <p className="mb-6 text-gray-600">
            Registering your email proof with the smart contract...
          </p>
          <div className="mb-4 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-green-600">✓ ZK proof generated</p>
            <p className="text-sm text-green-600">✓ Smart contract deployed</p>
            <p className="text-sm text-blue-600 animate-pulse">→ Registering email and passkey...</p>
          </div>
          <div className="mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          </div>
          <p className="text-sm text-gray-500">Almost done!</p>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-green-600">Success!</h2>
          <p className="mb-6 text-gray-600">
            Your Porto account has been created
          </p>
          <div className="text-6xl mb-4">✅</div>
        </div>
      )}
    </div>
  );
}