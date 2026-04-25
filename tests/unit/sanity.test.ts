import { describe, it, expect } from 'vitest';

// Sanity test: proves Vitest is wired up and the unit project executes test
// files end-to-end. Delete once a real test exists in this directory.
describe('vitest sanity', () => {
  it('runs the unit project', () => {
    expect(2 + 2).toBe(4);
  });
});
