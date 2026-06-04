import { useState, useCallback } from 'react';
import { isAuthenticated, loginWithPassword, loginWithPin, saveGoogleSession, logout as doLogout } from '../utils/auth';

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());

  const login = useCallback((username: string, password: string): boolean => {
    const success = loginWithPassword(username, password);
    if (success) setAuthenticated(true);
    return success;
  }, []);

  const pinLogin = useCallback(async (pin: string): Promise<boolean> => {
    const success = await loginWithPin(pin);
    if (success) setAuthenticated(true);
    return success;
  }, []);

  const googleLogin = useCallback((firstName: string) => {
    saveGoogleSession(firstName);
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setAuthenticated(false);
  }, []);

  return { authenticated, login, pinLogin, googleLogin, logout };
}
