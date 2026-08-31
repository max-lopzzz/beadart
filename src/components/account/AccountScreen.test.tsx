import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import userEvent from '@testing-library/user-event';

import { AccountScreen } from './AccountScreen';
import type { SyncStatus } from '../../hooks/useAccount';

type MockUser = {
  uid: string;
  email: string | null;
};

const mockAccount: {
  user: MockUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  syncStatus: SyncStatus;
  register: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
} = {
  user: null,
  loading: false,
  isAuthenticated: false,
  syncStatus: 'offline',
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
};

vi.mock('../../hooks/useAccount', () => ({
  useAccount: () => mockAccount,
}));

afterEach(() => {
  vi.clearAllMocks();

  mockAccount.user = null;
  mockAccount.loading = false;
  mockAccount.isAuthenticated = false;
  mockAccount.syncStatus = 'offline';

  mockAccount.register.mockReset();
  mockAccount.login.mockReset();
  mockAccount.logout.mockReset();
});

describe('AccountScreen', () => {
  it('explains that an account is optional', () => {
    render(<AccountScreen onBack={vi.fn()} />);

    expect(
      screen.getByText(/an account is optional/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/stored locally on this device/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /synchronize your patterns and palettes between devices/i,
      ),
    ).toBeInTheDocument();
  });

  it('allows the user to switch to account creation', async () => {
    const user = userEvent.setup();

    render(<AccountScreen onBack={vi.fn()} />);

    await user.click(
      screen.getByRole('button', {
        name: /switch to create account/i,
      }),
    );

    const form = screen.getByRole('form', {
      name: /create account form/i,
    });

    expect(form).toBeInTheDocument();

    expect(
      within(form).getByRole('button', {
        name: /^create account$/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/email/i)).toHaveAttribute(
      'autocomplete',
      'email',
    );

    expect(screen.getByLabelText(/password/i)).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
  });

  it('signs in with the submitted credentials', async () => {
    const user = userEvent.setup();

    mockAccount.login.mockResolvedValue({
      uid: 'user-1',
      email: 'test@example.com',
    });

    render(<AccountScreen onBack={vi.fn()} />);

    const form = screen.getByRole('form', {
      name: /sign in form/i,
    });

    await user.type(
      screen.getByLabelText(/email/i),
      'test@example.com',
    );

    await user.type(
      screen.getByLabelText(/password/i),
      'password123',
    );

    await user.click(
      within(form).getByRole('button', {
        name: /^sign in$/i,
      }),
    );

    await waitFor(() => {
      expect(mockAccount.login).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
    });
  });

  it('creates an account with the submitted credentials', async () => {
    const user = userEvent.setup();

    mockAccount.register.mockResolvedValue({
      uid: 'user-1',
      email: 'new@example.com',
    });

    render(<AccountScreen onBack={vi.fn()} />);

    await user.click(
      screen.getByRole('button', {
        name: /switch to create account/i,
      }),
    );

    const form = screen.getByRole('form', {
      name: /create account form/i,
    });

    await user.type(
      screen.getByLabelText(/email/i),
      'new@example.com',
    );

    await user.type(
      screen.getByLabelText(/password/i),
      'password123',
    );

    await user.click(
      within(form).getByRole('button', {
        name: /^create account$/i,
      }),
    );

    await waitFor(() => {
      expect(mockAccount.register).toHaveBeenCalledWith(
        'new@example.com',
        'password123',
      );
    });
  });

  it('shows an authentication error', async () => {
    const user = userEvent.setup();

    mockAccount.login.mockRejectedValue(
      new Error('Invalid email or password.'),
    );

    render(<AccountScreen onBack={vi.fn()} />);

    const form = screen.getByRole('form', {
      name: /sign in form/i,
    });

    await user.type(
      screen.getByLabelText(/email/i),
      'test@example.com',
    );

    await user.type(
      screen.getByLabelText(/password/i),
      'wrong-password',
    );

    await user.click(
      within(form).getByRole('button', {
        name: /^sign in$/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('alert'),
      ).toHaveTextContent('Invalid email or password.');
    });
  });

  it('calls onBack when Back is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(<AccountScreen onBack={onBack} />);

    await user.click(
      screen.getByRole('button', {
        name: /back/i,
      }),
    );

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows the authenticated account', () => {
    mockAccount.user = {
      uid: 'user-1',
      email: 'test@example.com',
    };

    mockAccount.isAuthenticated = true;

    render(<AccountScreen onBack={vi.fn()} />);

    expect(
      screen.getByText('test@example.com'),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /your beadart data can now be synchronized between devices/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: /sign out/i,
      }),
    ).toBeInTheDocument();
  });

  it('signs out the authenticated user', async () => {
    const user = userEvent.setup();

    mockAccount.user = {
      uid: 'user-1',
      email: 'test@example.com',
    };

    mockAccount.isAuthenticated = true;

    mockAccount.logout.mockResolvedValue(undefined);

    render(<AccountScreen onBack={vi.fn()} />);

    await user.click(
      screen.getByRole('button', {
        name: /sign out/i,
      }),
    );

    expect(mockAccount.logout).toHaveBeenCalledTimes(1);
  });

  it('shows a live sync badge once both listeners are connected', () => {
    mockAccount.user = {
      uid: 'user-1',
      email: 'test@example.com',
    };
    mockAccount.isAuthenticated = true;
    mockAccount.syncStatus = 'live';

    render(<AccountScreen onBack={vi.fn()} />);

    expect(screen.getByText(/live sync active/i)).toBeInTheDocument();
  });

  it('shows a connecting badge while listeners are still attaching', () => {
    mockAccount.user = {
      uid: 'user-1',
      email: 'test@example.com',
    };
    mockAccount.isAuthenticated = true;
    mockAccount.syncStatus = 'connecting';

    render(<AccountScreen onBack={vi.fn()} />);

    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('warns when sync has been interrupted', () => {
    mockAccount.user = {
      uid: 'user-1',
      email: 'test@example.com',
    };
    mockAccount.isAuthenticated = true;
    mockAccount.syncStatus = 'error';

    render(<AccountScreen onBack={vi.fn()} />);

    expect(
      screen.getByText(/sync interrupted/i),
    ).toBeInTheDocument();
  });

  it('shows no sync badge when offline', () => {
    mockAccount.user = {
      uid: 'user-1',
      email: 'test@example.com',
    };
    mockAccount.isAuthenticated = true;
    mockAccount.syncStatus = 'offline';

    render(<AccountScreen onBack={vi.fn()} />);

    expect(screen.queryByText(/live sync active/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connecting/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sync interrupted/i)).not.toBeInTheDocument();
  });
});
