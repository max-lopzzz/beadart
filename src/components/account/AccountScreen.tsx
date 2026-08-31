import { FormEvent, useState } from 'react';

import { useAccount } from '../../hooks/useAccount';

interface AccountScreenProps {
  onBack: () => void;
}

export function AccountScreen({ onBack }: AccountScreenProps) {
  const {
    user,
    loading,
    isAuthenticated,
    register,
    login,
    logout,
  } = useAccount();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      if (mode === 'register') {
        await register(email.trim(), password);

        setSuccess(
          'Account created. Your local patterns and palettes are now synced.',
        );
      } else {
        await login(email.trim(), password);

        setSuccess('Signed in successfully.');
      }

      setPassword('');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';

      setError(message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <p>Loading account...</p>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="container">
        <h1>Account</h1>

        <p>
          Signed in as <strong>{user.email}</strong>
        </p>

        <p>
          Your BeadArt data can now be synchronized between devices.
        </p>

        {success && <p role="status">{success}</p>}

        <button
          type="button"
          onClick={async () => {
            setError(null);
            setBusy(true);

            try {
              await logout();
            } catch {
              setError('Could not sign out. Please try again.');
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
        >
          {busy ? 'Signing out...' : 'Sign out'}
        </button>

        {error && <p role="alert">{error}</p>}

        <button type="button" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Account</h1>

      <p>
        An account is optional. Your BeadArt patterns are always stored
        locally on this device.
      </p>

      <p>
        Create an account if you want to synchronize your patterns and
        palettes between devices.
      </p>

      <div>
        <button
          type="button"
          aria-label="Switch to sign in"
          onClick={() => {
            setMode('login');
            setError(null);
            setSuccess(null);
          }}
        >
          Sign in
        </button>

        <button
          type="button"
          aria-label="Switch to create account"
          onClick={() => {
            setMode('register');
            setError(null);
            setSuccess(null);
          }}
        >
          Create account
        </button>
      </div>

    <form
        onSubmit={handleSubmit}
        aria-label={
          mode === 'register'
            ? 'Create account form'
            : 'Sign in form'
        }
      >
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            autoComplete={
              mode === 'register'
                ? 'new-password'
                : 'current-password'
            }
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy
            ? mode === 'register'
              ? 'Creating account...'
              : 'Signing in...'
            : mode === 'register'
              ? 'Create account'
              : 'Sign in'}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      <button type="button" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
