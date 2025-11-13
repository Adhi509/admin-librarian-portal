-- Create renewal_requests table
CREATE TABLE IF NOT EXISTS public.renewal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrow_record_id UUID NOT NULL REFERENCES public.borrow_records(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  librarian_id UUID REFERENCES public.profiles(id),
  librarian_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.renewal_requests ENABLE ROW LEVEL SECURITY;

-- Members can create their own renewal requests and view them
CREATE POLICY "Members can create own renewal requests"
  ON public.renewal_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Members can view own renewal requests"
  ON public.renewal_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = member_id);

-- Staff can view and manage all renewal requests
CREATE POLICY "Staff can view all renewal requests"
  ON public.renewal_requests
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'librarian'));

CREATE POLICY "Staff can update renewal requests"
  ON public.renewal_requests
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'librarian'));

-- Create indexes for faster queries
CREATE INDEX idx_renewal_requests_status ON public.renewal_requests(status);
CREATE INDEX idx_renewal_requests_member ON public.renewal_requests(member_id);