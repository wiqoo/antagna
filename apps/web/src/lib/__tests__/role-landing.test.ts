import { describe, it, expect } from 'vitest';
import { roleLanding } from '../role-landing';

describe('roleLanding', () => {
  it('sends PMs and production managers to /projects', () => {
    expect(roleLanding('project_manager')).toBe('/projects');
    expect(roleLanding('production_manager')).toBe('/projects');
  });

  it('sends AMs to /crm', () => {
    expect(roleLanding('account_manager')).toBe('/crm');
  });

  it('sends HR to /team', () => {
    expect(roleLanding('hr')).toBe('/team');
  });

  it('sends finance to /reports', () => {
    expect(roleLanding('finance')).toBe('/reports');
  });

  it('sends sysadmins and GMs to /dashboard (overview bento)', () => {
    expect(roleLanding('system_admin')).toBe('/dashboard');
    expect(roleLanding('general_manager')).toBe('/dashboard');
  });

  it('defaults ICs (user) and unknown roles to /tasks', () => {
    expect(roleLanding('user')).toBe('/tasks');
    expect(roleLanding('shooter')).toBe('/tasks');
    expect(roleLanding(null)).toBe('/tasks');
    expect(roleLanding(undefined)).toBe('/tasks');
    expect(roleLanding('')).toBe('/tasks');
  });
});
