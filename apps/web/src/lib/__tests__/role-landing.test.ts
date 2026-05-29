import { describe, it, expect } from 'vitest';
import { roleLanding } from '../role-landing';

describe('roleLanding', () => {
  it('keeps sysadmins and GMs on /dashboard (full overview bento)', () => {
    expect(roleLanding('system_admin')).toBe('/dashboard');
    expect(roleLanding('general_manager')).toBe('/dashboard');
  });

  it('sends every non-admin position to /my-day', () => {
    expect(roleLanding('project_manager')).toBe('/my-day');
    expect(roleLanding('production_manager')).toBe('/my-day');
    expect(roleLanding('account_manager')).toBe('/my-day');
    expect(roleLanding('hr')).toBe('/my-day');
    expect(roleLanding('finance')).toBe('/my-day');
    expect(roleLanding('user')).toBe('/my-day');
    expect(roleLanding('shooter')).toBe('/my-day');
  });

  it('defaults unknown / empty roles to /my-day', () => {
    expect(roleLanding(null)).toBe('/my-day');
    expect(roleLanding(undefined)).toBe('/my-day');
    expect(roleLanding('')).toBe('/my-day');
  });
});
