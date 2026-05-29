import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinPad } from './PinPad';

function renderPinPad({ onComplete, onCancel, onWrong, lockedSeconds }: Partial<Parameters<typeof PinPad>[0]> = {}) {
  const handlers = {
    onComplete: onComplete ?? vi.fn(),
    onCancel: onCancel ?? vi.fn(),
    onWrong: onWrong ?? vi.fn(),
  };
  render(<PinPad {...handlers} lockedSeconds={lockedSeconds} />);
  return handlers;
}

describe('PinPad', () => {
  it('renders 12 keys in the keypad', () => {
    renderPinPad();
    const keys = screen.getAllByRole('button');
    // 10 digits + backspace + cancel
    expect(keys.length).toBe(12);
  });

  it('shows 4 empty dots', () => {
    renderPinPad();
    const dots = document.querySelectorAll('.pin-dot');
    expect(dots.length).toBe(4);
    dots.forEach((dot) => expect(dot.classList).not.toContain('filled'));
  });

  it('fills a dot per digit press', () => {
    renderPinPad();
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    const dots = document.querySelectorAll('.pin-dot.filled');
    expect(dots.length).toBe(2);
  });

  it('calls onComplete with 4-digit PIN', () => {
    const onComplete = vi.fn();
    renderPinPad({ onComplete });
    ['1', '2', '3', '4'].forEach((digit) => {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    });
    expect(onComplete).toHaveBeenCalledWith('1234');
  });

  it('removes last digit on backspace', () => {
    renderPinPad();
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '⌫' }));
    expect(document.querySelectorAll('.pin-dot.filled').length).toBe(1);
  });

  it('calls onCancel and clears digits on cancel', () => {
    const onCancel = vi.fn();
    renderPinPad({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(document.querySelector('.pin-cancel')!);
    expect(onCancel).toHaveBeenCalled();
    expect(document.querySelectorAll('.pin-dot.filled').length).toBe(0);
  });

  it('shows lockout message when lockedSeconds > 0', () => {
    renderPinPad({ lockedSeconds: 30 });
    expect(screen.getByText(/Locked\. Wait 30s/)).toBeInTheDocument();
  });

  it('does not accept input during lockout', () => {
    const onComplete = vi.fn();
    renderPinPad({ onComplete, lockedSeconds: 5 });
    // During lockout, only the lockout message is shown - no keypad at all
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.pin-dot').length).toBe(0);
  });

  it('does not allow cancel during lockout', () => {
    const onCancel = vi.fn();
    renderPinPad({ onCancel, lockedSeconds: 5 });
    // Cancel button is not rendered during lockout
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
