import type { TestingLibraryChaiExpectPlugin } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface JestAssertion<T> extends TestingLibraryChaiExpectPlugin<T> {}
}
