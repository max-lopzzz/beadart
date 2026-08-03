import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceTypeStep } from './SourceTypeStep';

describe('SourceTypeStep', () => {
  it('calls onSelect with "digital" when the digital option is clicked', async () => {
    const onSelect = vi.fn();
    render(<SourceTypeStep onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /digital pixel art image/i }));

    expect(onSelect).toHaveBeenCalledWith('digital');
  });

  it('calls onSelect with "photo" when the photo option is clicked', async () => {
    const onSelect = vi.fn();
    render(<SourceTypeStep onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /photo of a drawing/i }));

    expect(onSelect).toHaveBeenCalledWith('photo');
  });
});
