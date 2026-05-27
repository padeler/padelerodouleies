import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

function Hello({ name }: { name: string }) {
  return <div>Hello {name}</div>;
}

describe('basic react render', () => {
  it('renders a simple component', () => {
    render(<Hello name="World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});
