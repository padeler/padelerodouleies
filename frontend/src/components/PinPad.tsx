import { useState, useCallback, useEffect } from 'react';
import './PinPad.css';

interface PinPadProps {
  onComplete: (pin: string) => void;
  onCancel: () => void;
  onWrong?: () => void;
  lockedSeconds?: number | null;
}

export function PinPad({ onComplete, onCancel, onWrong, lockedSeconds }: PinPadProps) {
  const [digits, setDigits] = useState('');
  const [shaking, setShaking] = useState(false);
  const [countdown, setCountdown] = useState(lockedSeconds ?? 0);

  useEffect(() => {
    if (lockedSeconds) {
      setCountdown(lockedSeconds);
    }
  }, [lockedSeconds]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleDigit = useCallback((d: string) => {
    if (countdown > 0) return;
    setDigits((prev) => {
      const next = prev + d;
      if (next.length === 4) {
        onComplete(next);
      }
      return next;
    });
  }, [onComplete, countdown]);

  const handleBackspace = useCallback(() => {
    if (countdown > 0) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [countdown]);

  const handleCancel = useCallback(() => {
    if (countdown > 0) return;
    setDigits('');
    setShaking(false);
    onCancel();
  }, [onCancel, countdown]);

  // Keyboard support for PIN input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (countdown > 0) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleDigit, handleBackspace, handleCancel, countdown]);

  const handleWrong = useCallback(() => {
    setShaking(true);
    setDigits('');
    onWrong?.();
    setTimeout(() => setShaking(false), 600);
  }, [onWrong]);

  // Expose via custom event for parent to trigger
  useEffect(() => {
    const handler = () => handleWrong();
    window.addEventListener('pin-trigger-wrong', handler);
    return () => window.removeEventListener('pin-trigger-wrong', handler);
  }, [handleWrong]);

  const dots = Array.from({ length: 4 }, (_, i) => i < digits.length);

  if (countdown > 0) {
    return (
      <div className="pin-pad-overlay">
        <div className="pin-pad">
          <div className="pin-lockout-msg">
            Locked. Wait {countdown}s
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pin-pad-overlay">
      <div className="pin-pad">
        <div className={`pin-dots ${shaking ? 'shake' : ''}`}>
          {dots.map((filled, i) => (
            <span key={i} className={`pin-dot ${filled ? 'filled' : ''}`} />
          ))}
        </div>
        <div className="pin-keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) => {
            if (key === '') return <div key={i} className="pin-key empty" />;
            if (key === '⌫') {
              return (
                <button key={i} className="pin-key" type="button" onClick={handleBackspace}>
                  ⌫
                </button>
              );
            }
            return (
              <button key={key} className="pin-key" type="button" onClick={() => handleDigit(key)}>
                {key}
              </button>
            );
          })}
        </div>
        <button className="pin-cancel" type="button" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
