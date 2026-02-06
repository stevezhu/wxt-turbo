import { describe, it, expect } from 'vitest';
import mod from '../src/index';

describe('wxt-turbo', () => {
  it('should export a defineWxtModule object', () => {
    expect(mod).toBeDefined();
    expect(mod.configKey).toBe('turbo');
    expect(typeof mod.setup).toBe('function');
  });
});
