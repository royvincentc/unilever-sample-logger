import { useState, useCallback } from 'react';
import { isAuthenticated, loginWithPassword, loginWithPin, loginWithGoogle, logout as doLogout } from '../utils/auth';

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());

  const login = useCallback((username: string, password: string): boolean => {
    const success = loginWithPassword(username, password);
    if (success) setAuthenticated(true);
    return success;
  }, []);

  const pinLogin = useCallback((pin: string): boolean => {
    const success = loginWithPin(pin);
    if (success) setAuthenticated(true);
    return success;
  }, []);

  const googleLogin = useCallback(async (): Promise<boolean> => {
    const res = await loginWithGoogle();
    if (res.success) {
      setAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setAuthenticated(false);
  }, []);

  return { authenticated, login, pinLogin, googleLogin, logout };
}
