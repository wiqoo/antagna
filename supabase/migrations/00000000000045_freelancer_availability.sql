-- C2: freelancer availability windows (so the assignment composer can see who's free).
CREATE TABLE IF NOT EXISTS public.freelancer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'available', -- 'available' | 'busy' | 'tentative'
  note text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fa_by_freelancer
  ON public.freelancer_availability (freelancer_id, starts_at);
