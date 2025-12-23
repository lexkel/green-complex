'use client';

// Google Auth imports - keeping for future use
// import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { config } from '@/config';

interface AuthContextType {
  accessToken: string | null;
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, passcode: string) => boolean;
  logout: () => void;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Simple passcode-based auth provider
function SimpleAuthProvider({ children }: { children: ReactNode }) {
  const USERS = config?.auth?.users || [];

  // Initialize auth state from localStorage
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === 'undefined') return false;
    const authStatus = localStorage.getItem('simple_auth');
    console.log('[AUTH] Initial check - authStatus:', authStatus);
    return authStatus === 'true';
  });

  // Initialize username from localStorage
  const [username, setUsername] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('simple_auth_username');
  });

  const login = (inputUsername: string, inputPasscode: string): boolean => {
    // Find matching user
    const user = USERS.find(
      u => u.username === inputUsername && u.passcode === inputPasscode
    );

    if (user) {
      // Update localStorage first
      localStorage.setItem('simple_auth', 'true');
      localStorage.setItem('simple_auth_username', user.username);

      // Batch state updates together to prevent multiple re-renders
      setUsername(user.username);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUsername(null);
    localStorage.removeItem('simple_auth');
    localStorage.removeItem('simple_auth_username');
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken: isAuthenticated ? 'simple-auth-token' : null,
        isAuthenticated,
        username,
        login,
        logout,
        isDemoMode: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Google Auth Provider - Keeping for future use
/*
function AuthProviderInner({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('google_access_token');
    const demoMode = localStorage.getItem('demo_mode');
    if (stored) {
      setAccessToken(stored);
    }
    if (demoMode === 'true') {
      setIsDemoMode(true);
    }
  }, []);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      localStorage.setItem('google_access_token', tokenResponse.access_token);
    },
    onError: () => {
      console.error('Login failed');
    },
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
  });

  const logout = () => {
    setAccessToken(null);
    setIsDemoMode(false);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('demo_mode');
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        isAuthenticated: !!accessToken || isDemoMode,
        login,
        logout,
        isDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
*/

export function AuthProvider({ children }: { children: ReactNode }) {
  // Use simple auth for now
  return <SimpleAuthProvider>{children}</SimpleAuthProvider>;

  // Google Auth - Keeping for future use
  /*
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId || clientId === 'your-client-id-here.apps.googleusercontent.com') {
    return <DemoModeProvider>{children}</DemoModeProvider>;
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </GoogleOAuthProvider>
  );
  */
}

export function LoginButton() {
  const { login, logout, isAuthenticated, username } = useAuth();
  const [inputUsername, setInputUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = () => {
    const success = login(inputUsername, passcode);
    if (!success) {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (isAuthenticated) {
    return (
      <button onClick={logout} className="auth-button logout-button">
        Sign Out {username ? `(${username})` : ''}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px', margin: '0 auto' }}>
      <input
        type="text"
        value={inputUsername}
        onChange={(e) => setInputUsername(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Move to passcode field
            const passcodeInput = e.currentTarget.nextElementSibling as HTMLInputElement;
            passcodeInput?.focus();
          }
        }}
        placeholder="Username"
        className="auth-input"
        style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          border: error ? '1px solid #dc2626' : '1px solid #3a3a3a',
          background: '#1a1a1a',
          color: 'white',
          fontSize: '1rem',
          textAlign: 'center',
          outline: 'none',
        }}
      />
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleLogin();
        }}
        placeholder="Passcode"
        className="auth-input"
        style={{
          padding: '1rem',
          borderRadius: '0.5rem',
          border: error ? '1px solid #dc2626' : '1px solid #3a3a3a',
          background: '#1a1a1a',
          color: 'white',
          fontSize: '1rem',
          textAlign: 'center',
          outline: 'none',
        }}
      />
      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.875rem', textAlign: 'center', margin: '-0.5rem 0 0 0' }}>
          Invalid username or passcode
        </p>
      )}
      <button onClick={handleLogin} className="auth-button login-button">
        Sign In
      </button>
    </div>
  );
}

// Google Login Button - Keeping for future use
/*
export function GoogleLoginButton() {
  const { login, logout, isAuthenticated, isDemoMode } = useAuth();

  const handleContinueWithoutLogin = () => {
    localStorage.setItem('demo_mode', 'true');
    window.location.reload();
  };

  if (isAuthenticated) {
    return (
      <button onClick={logout} className="auth-button logout-button">
        {isDemoMode ? 'Exit Demo' : 'Sign Out'}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px', margin: '0 auto' }}>
      <button onClick={login} className="auth-button login-button">
        Sign in with Google
      </button>
      <button
        onClick={handleContinueWithoutLogin}
        className="auth-button"
        style={{
          background: '#2a2a2a',
          color: '#9ca3af',
          border: '1px solid #3a3a3a'
        }}
      >
        Continue
      </button>
    </div>
  );
}
*/
