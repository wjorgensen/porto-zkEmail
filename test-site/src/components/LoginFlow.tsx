'use client';

import { useState } from 'react';

interface LoginFlowProps {
  onComplete: () => void;
  onBack: () => void;
}

export function LoginFlow({ onComplete, onBack }: LoginFlowProps) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  // Mock device discovery
  const discoverDevices = () => {
    // In production, this would check for existing passkeys
    const mockDevices = [
      { id: 'device-1', name: 'MacBook Pro', lastUsed: '2 hours ago' },
      { id: 'device-2', name: 'iPhone 15', lastUsed: 'Yesterday' },
    ];
    
    return mockDevices;
  };

  const devices = discoverDevices();

  const handleLogin = async () => {
    if (!selectedDevice) {
      alert('Please select a device');
      return;
    }

    // Mock login process
    console.log('Logging in with device:', selectedDevice);
    
    // Simulate authentication
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Welcome Back!</h2>
      <p className="mb-6 text-gray-600">
        Select a device to log in
      </p>

      <div className="space-y-3 mb-6">
        {devices.map((device) => (
          <button
            key={device.id}
            onClick={() => setSelectedDevice(device.id)}
            className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
              selectedDevice === device.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="font-semibold">{device.name}</div>
            <div className="text-sm text-gray-500">Last used: {device.lastUsed}</div>
          </button>
        ))}
      </div>

      {devices.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No devices found. Please sign up first.
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={!selectedDevice}
        className={`w-full py-3 px-6 rounded-lg font-bold transition-colors ${
          selectedDevice
            ? 'bg-blue-500 hover:bg-blue-600 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        Log In
      </button>

      <button
        onClick={onBack}
        className="mt-4 text-gray-500 hover:text-gray-600 text-sm underline block mx-auto"
      >
        Back
      </button>
    </div>
  );
}