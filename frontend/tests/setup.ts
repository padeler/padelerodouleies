import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock canvas-confetti (jsdom has no canvas support)
vi.mock('canvas-confetti', () => ({
  default: vi.fn().mockReturnValue({ reset: vi.fn() }),
}));

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
