import { useState, useEffect } from 'react';

const STORAGE_KEY = 'torn_api_key';
const EVENT_NAME = 'torn_api_key_changed';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    const handleChange = () => {
      setApiKeyState(localStorage.getItem(STORAGE_KEY));
    };
    window.addEventListener(EVENT_NAME, handleChange);
    return () => window.removeEventListener(EVENT_NAME, handleChange);
  }, []);

  const setApiKey = (key: string | null) => {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setApiKeyState(key);
    window.dispatchEvent(new Event(EVENT_NAME));
  };

  return { apiKey, setApiKey };
}
