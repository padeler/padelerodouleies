import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';
import type { ToastOptions } from 'react-hot-toast';

const defaultOptions: ToastOptions = {
  duration: 3000,
  style: {
    background: 'var(--bg, #1e1e1e)',
    color: 'var(--text, #fff)',
    border: '1px solid var(--border, #333)',
    borderRadius: 10,
    fontSize: 14,
    padding: '12px 16px',
  },
};

export function notifySuccess(message: string, options?: ToastOptions) {
  return toast.success(message, { ...defaultOptions, icon: '✅', ...options });
}

export function notifyError(message: string, options?: ToastOptions) {
  return toast.error(message, { ...defaultOptions, icon: '❌', ...options });
}

export function notifyInfo(message: string, options?: ToastOptions) {
  return toast(message, { ...defaultOptions, icon: 'ℹ️', ...options });
}

export function notifyCelebration(message: string, toastId?: string) {
  toast(message, {
    ...defaultOptions,
    id: toastId,
    icon: '🎉',
    style: { ...defaultOptions.style, fontWeight: 700 },
    duration: 3500,
  });

  const count = 200;
  const defaults = { origin: { y: 0.7 }, spread: 90, ticks: 90 };

  confetti({
    ...defaults,
    particleCount: count,
    colors: ['#7b2ff7', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'],
  });

  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: Math.floor(count * 0.6),
      colors: ['#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#7b2ff7'],
    });
  }, 250);
}
