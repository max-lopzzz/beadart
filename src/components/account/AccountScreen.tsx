import { FormEvent, useState } from 'react';

import { SyncStatus, useAccount } from '../../hooks/useAccount';

interface AccountScreenProps {
  onBack: () => void;
}

const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  offline: 'Not synced',
  connecting: 'Connecting…',
  live: 'Live sync active',
  error: 'Sync interrupted — check your connection',
};

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === 'offline') {
    return null;
  }

  return (
    <p className="sync-badge" data-status={status} role="status">
      <span className="sync-dot" aria-hidden="true" />
      {SYNC_STATUS_LABEL[status]}
    </p>
  );
}

export function AccountScreen({ onBack }: AccountScreenProps) {
  const {
    user,
    loading,
    isAuthenticated,
    syncStatus = 'offline',
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
      <div className="container-narrow">
        <p>Loading account...</p>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="container-narrow">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onBack}
          style={{ marginBottom: 'var(--space-4)' }}
        >
          ← Back
        </button>

        <h2>Account</h2>

        <div className="surface" style={{ padding: 'var(--space-5)' }}>
          <p style={{ marginBottom: 'var(--space-2)' }}>
            Signed in as <strong>{user.email}</strong>
          </p>

          <p>Your BeadArt data can now be synchronized between devices.</p>

          <SyncBadge status={syncStatus} />

          {success && (
            <p role="status" style={{ color: 'var(--teal-hover)' }}>
              {success}
            </p>
          )}

          {error && <p role="alert">{error}</p>}

          <button
            type="button"
            className="btn btn-secondary"
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
        </div>
      </div>
    );
  }

  return (
    <div className="container-narrow">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onBack}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        ← Back
      </button>

      <h2>Account</h2>

      <p>
        An account is optional. Your BeadArt patterns are always stored
        locally on this device.
      </p>

      <p>
        Create an account if you want to synchronize your patterns and
        palettes between devices.
      </p>

      <div className="segmented" role="group" aria-label="Account mode">
        <button
          type="button"
          className="segmented-btn"
          data-active={mode === 'login'}
          aria-label="Switch to sign in"
          aria-pressed={mode === 'login'}
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
          className="segmented-btn"
          data-active={mode === 'register'}
          aria-label="Switch to create account"
          aria-pressed={mode === 'register'}
          onClick={() => {
            setMode('register');
            setError(null);
            setSuccess(null);
          }}
        >
          Create account
        </button>
      </div>

      <div className="surface" style={{ padding: 'var(--space-5)' }}>
        <form
          className="account-form"
          onSubmit={handleSubmit}
          aria-label={
            mode === 'register' ? 'Create account form' : 'Sign in form'
          }
        >
          <div className="field">
            <label htmlFor="account-email">Email</label>
            <input
              id="account-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="account-password">Password</label>
            <input
              id="account-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoComplete={
                mode === 'register' ? 'new-password' : 'current-password'
              }
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={busy}>
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
      </div>
    </div>
  );
}
