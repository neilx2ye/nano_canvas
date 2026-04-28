/**
 * API Key Configuration Component - Ollama Style
 */

import React, { useState, useEffect } from 'react';
import { getApiKey, setApiKey, removeApiKey, hasApiKey } from '../../services/nanoBananaApi';

function maskApiKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

export const ApiKeyConfig: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (hasApiKey()) {
      setSavedKey(getApiKey());
    }
  }, []);

  const handleSave = () => {
    const trimmedKey = inputValue.trim();
    if (!trimmedKey) {
      showMessage('Please enter an API key', 'error');
      return;
    }
    setApiKey(trimmedKey);
    setSavedKey(trimmedKey);
    setInputValue('');
    showMessage('API key saved', 'success');
  };

  const handleDelete = () => {
    removeApiKey();
    setSavedKey(null);
    setInputValue('');
    showMessage('API key removed', 'success');
  };

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
  };

  return (
    <div className="bg-snow rounded-container px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-stone" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        <span className="text-sm font-sans font-medium text-near-black">API Key</span>
      </div>

      {savedKey ? (
        <div className="flex items-center gap-2">
          <span className="px-3 py-2 text-sm font-mono bg-light-gray rounded-pill text-near-black">
            {maskApiKey(savedKey)}
          </span>
          <button
            onClick={handleDelete}
            className="px-3 py-2 text-sm font-sans text-stone hover:text-black transition-colors"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Enter your API key"
            className="px-4 py-2 text-sm font-mono bg-white border border-light-gray rounded-pill text-near-black placeholder:text-silver focus:outline-none focus:border-black"
          />
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-sans bg-black text-white rounded-pill hover:bg-near-black transition-colors"
          >
            Save
          </button>
        </div>
      )}

      {message && (
        <div className={`mt-3 px-3 py-2 text-xs font-sans rounded-pill ${messageType === 'success' ? 'bg-light-gray text-near-black' : 'bg-light-gray text-near-black'}`}>
          {message}
        </div>
      )}
    </div>
  );
};
