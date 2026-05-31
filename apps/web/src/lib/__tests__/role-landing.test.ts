import { describe, it, expect } from 'vitest';
import { roleLanding } from '../role-landing';

describe('roleLanding', () => {
  it('lands everyone on the unified /dashboard (my-day merged in)', () => {
    expect(roleLanding('system_admin')).toBe('/dashboard');
    expect(roleLanding('general_manager')).toBe('/dashboard');
    expect(roleLanding('project_manager')).toBe('/dashboard');
    expect(roleLanding('production_director')).toBe('/dashboard');
    expect(roleLanding('account_manager')).toBe('/dashboard');
    expect(roleLanding('videographer')).toBe('/dashboard');
  });

  it('defaults unknown / empty roles to /dashboard', () => {
    expect(roleLanding(null)).toBe('/dashboard');
    expect(roleLanding(undefined)).toBe('/dashboard');
    expect(roleLanding('')).toBe('/dashboard');
  });
});
