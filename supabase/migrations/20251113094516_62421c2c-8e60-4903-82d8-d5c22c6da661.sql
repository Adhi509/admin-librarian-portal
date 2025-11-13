-- Create extension_requests table
CREATE TABLE IF NOT EXISTS public.extension_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrow_record_id UUID NOT NULL REFERENCES public.borrow_records(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_days INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  librarian_id UUID REFERENCES public.profiles(id),
  librarian_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT requested_days_positive CHECK (requested_days > 0 AND requested_days <= 30)
);

-- Enable RLS
ALTER TABLE public.extension_requests ENABLE ROW LEVEL SECURITY;

-- Members can create their own requests and view them
CREATE POLICY "Members can create own extension requests"
  ON public.extension_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Members can view own extension requests"
  ON public.extension_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = member_id);

-- Staff can view and manage all requests
CREATE POLICY "Staff can view all extension requests"
  ON public.extension_requests
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'librarian'));

CREATE POLICY "Staff can update extension requests"
  ON public.extension_requests
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'librarian'));

-- Create index for faster queries
CREATE INDEX idx_extension_requests_status ON public.extension_requests(status);
CREATE INDEX idx_extension_requests_member ON public.extension_requests(member_id);