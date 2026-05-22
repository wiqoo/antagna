/**
 * Shared types for the Email Intelligence pipeline.
 *
 *   extract → ExtractedEmail JSON
 *   generate → AiSuggestion[]
 *   execute → ExecutionResult
 */

export type Intent =
  | 'new_inquiry'
  | 'project_update'
  | 'meeting_request'
  | 'complaint'
  | 'follow_up'
  | 'invoice'
  | 'introduction'
  | 'thank_you'
  | 'other';

export type Sentiment = 'positive' | 'neutral' | 'concerned' | 'angry';
export type Urgency = 'low' | 'medium' | 'high';

export interface ExtractedEmail {
  language: 'ar' | 'en' | 'mixed';
  intent: Intent;
  sender: {
    name: string | null;
    company: string | null;
    role: string | null;
    email: string;
    phone: string | null;
  };
  project_signals: {
    is_new_project: boolean;
    existing_project_hints: string[]; // texts that look like project codes/names
    project_type: 'shoot' | 'edit' | 'campaign' | 'consulting' | 'other' | null;
    proposed_title_ar: string | null;
    proposed_title_en: string | null;
  };
  dates: {
    shoot_dates_iso: string[];
    delivery_deadline_iso: string | null;
    meeting_proposed_at_iso: string | null;
  };
  budget: {
    amount_sar: number | null;
    range: '10-25k' | '25-50k' | '50-100k' | '100k+' | null;
    is_estimate: boolean;
  };
  deliverables: Array<{
    format: 'reel' | 'short' | 'long' | 'photo' | 'print' | 'other';
    count: number;
    duration_sec: number | null;
    platform: string | null;
  }>;
  mentioned_people: Array<{ name: string; role: string | null }>;
  mentioned_companies: string[];
  action_items: Array<{
    description: string;
    owner_hint: string | null;
    due_iso: string | null;
  }>;
  sentiment: Sentiment;
  urgency: Urgency;
  reply_needed: boolean;
  /** Summary of the email for queue cards (Arabic). */
  summary_ar: string;
  /** Overall extraction confidence — 0-1. */
  confidence: number;
}

export type SuggestionType =
  | 'create_client'
  | 'create_contact'
  | 'create_project'
  | 'update_project'
  | 'create_task'
  | 'create_lead'
  | 'link_thread_to_project'
  | 'reply_draft'
  | 'escalate_to_human';

// Per-type proposed_data shapes — also enforced at execution time.

export interface ProposedCreateClient {
  name_ar: string;
  name_en?: string | null;
  industry?: string | null;
  country?: string;
  city?: string | null;
  website_url?: string | null;
  source_sender_email?: string | null;
}

export interface ProposedCreateContact {
  client_id?: string | null; // existing client id, or null if new
  full_name: string;
  full_name_ar?: string | null;
  job_title?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  is_primary?: boolean;
}

export interface ProposedCreateLead {
  unmatched_from_email: string;
  unmatched_from_name?: string | null;
  client_id?: string | null;
  ai_summary?: string | null;
  temperature_score?: number | null;
  estimated_value_sar?: number | null;
}

export interface ProposedCreateProject {
  client_id: string | null; // null when paired with a create_client
  title: string;
  title_ar?: string | null;
  description?: string | null;
  project_type: 'shoot' | 'edit_only' | 'content_creation' | 'consulting' | 'other';
  shoot_starts_at_iso?: string | null;
  delivery_due_at_iso?: string | null;
  contracted_value_sar?: number | null;
  deliverables?: Array<{
    format: string;
    aspect_ratio?: string;
    duration_sec?: number | null;
    count: number;
    platform?: string;
  }>;
}

export interface ProposedUpdateProject {
  project_id: string;
  field_updates: Partial<{
    delivery_due_at_iso: string;
    shoot_starts_at_iso: string;
    shoot_ends_at_iso: string;
    contracted_value_sar: number;
    description: string;
  }>;
  brief_note?: string | null;
}

export interface ProposedCreateTask {
  project_id?: string | null;
  assignee_profile_id?: string | null;
  title: string;
  due_iso?: string | null;
  notes?: string | null;
}

export interface ProposedLinkThread {
  project_id: string;
}

export interface ProposedReplyDraft {
  body_html: string;
  body_text?: string | null;
  tone: 'formal' | 'friendly' | 'neutral';
}

export interface ProposedEscalate {
  reason: string;
  recommended_recipient_profile_id?: string | null;
}

export type ProposedData =
  | ({ type: 'create_client' } & ProposedCreateClient)
  | ({ type: 'create_contact' } & ProposedCreateContact)
  | ({ type: 'create_lead' } & ProposedCreateLead)
  | ({ type: 'create_project' } & ProposedCreateProject)
  | ({ type: 'update_project' } & ProposedUpdateProject)
  | ({ type: 'create_task' } & ProposedCreateTask)
  | ({ type: 'link_thread_to_project' } & ProposedLinkThread)
  | ({ type: 'reply_draft' } & ProposedReplyDraft)
  | ({ type: 'escalate_to_human' } & ProposedEscalate);

export interface ExecutionResult {
  ok: boolean;
  created_entity_type?: string;
  created_entity_id?: string;
  error?: string;
}

/** Confidence thresholds per suggestion type for queue routing. */
export const CONFIDENCE_THRESHOLDS: Record<
  SuggestionType,
  { quick: number; standard: number; auto: number }
> = {
  // type → { below standard = info-only, standard..quick = needs review, ≥quick = quick-approve, ≥auto = auto-execute }
  create_client:           { quick: 0.85, standard: 0.70, auto: 0.99 }, // risky → no auto
  create_contact:          { quick: 0.85, standard: 0.70, auto: 0.95 },
  create_lead:             { quick: 0.80, standard: 0.65, auto: 0.99 }, // we already auto-create via gmail-routing
  create_project:          { quick: 0.85, standard: 0.70, auto: 0.99 }, // never auto
  update_project:          { quick: 0.85, standard: 0.70, auto: 0.95 },
  create_task:             { quick: 0.80, standard: 0.65, auto: 0.95 },
  link_thread_to_project:  { quick: 0.90, standard: 0.75, auto: 0.92 },
  reply_draft:             { quick: 0.85, standard: 0.70, auto: 0.99 }, // always human-review
  escalate_to_human:       { quick: 0.70, standard: 0.50, auto: 0.99 },
};
