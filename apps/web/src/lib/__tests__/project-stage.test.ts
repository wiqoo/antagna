import { describe, it, expect } from 'vitest';
import {
  PROJECT_STAGE_ORDER,
  stageTone,
  stageLabelAr,
} from '../project-stage';

describe('stageLabelAr', () => {
  it('returns the Arabic label for known stages', () => {
    expect(stageLabelAr('shooting')).toBe('تصوير');
    expect(stageLabelAr('delivered')).toBe('مُسلَّم');
    expect(stageLabelAr('cancelled')).toBe('مُلغى');
  });

  it('returns "—" for null/undefined', () => {
    expect(stageLabelAr(null)).toBe('—');
    expect(stageLabelAr(undefined)).toBe('—');
  });

  it('falls back to the raw stage string when unknown', () => {
    expect(stageLabelAr('totally_made_up')).toBe('totally_made_up');
  });
});

describe('stageTone', () => {
  it('maps the happy path to its color', () => {
    expect(stageTone('delivered')).toBe('success');
    expect(stageTone('shooting')).toBe('warning'); // in-flight stages flag attention
    expect(stageTone('lead')).toBe('neutral');
    expect(stageTone('cancelled')).toBe('danger');
    expect(stageTone('lost')).toBe('danger');
  });

  it('defaults to neutral for null/undefined/unknown', () => {
    expect(stageTone(null)).toBe('neutral');
    expect(stageTone(undefined)).toBe('neutral');
    expect(stageTone('unknown_stage_xyz')).toBe('neutral');
  });
});

describe('PROJECT_STAGE_ORDER', () => {
  it('is the canonical lifecycle (lead → delivered, no archived/lost/cancelled in the happy path)', () => {
    expect(PROJECT_STAGE_ORDER[0]).toBe('lead');
    expect(PROJECT_STAGE_ORDER[PROJECT_STAGE_ORDER.length - 1]).toBe('delivered');
    expect(PROJECT_STAGE_ORDER).not.toContain('archived');
    expect(PROJECT_STAGE_ORDER).not.toContain('lost');
  });
});
