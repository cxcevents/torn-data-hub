import { useState, useEffect } from 'react';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    return localStorage.getItem('torn_api_key');
  });

  const setApiKey = (key: string | null) => {
    if (key) {
      localStorage.setItem('torn_api_key', key);
    } else {
      localStorage.removeItem('torn_api_key');
    }
    setApiKeyState(key);
  };

  return { apiKey, setApiKey };
}
