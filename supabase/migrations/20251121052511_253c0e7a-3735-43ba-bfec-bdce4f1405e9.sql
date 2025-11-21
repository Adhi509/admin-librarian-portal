-- Create fine_payments table to track member fine payments
CREATE TABLE public.fine_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL,
  borrow_record_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT,
  transaction_reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create damaged_books table to track damaged book reports
CREATE TABLE public.damaged_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL,
  reported_by UUID NOT NULL,
  report_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  damage_description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'minor',
  status TEXT NOT NULL DEFAULT 'reported',
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.fine_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damaged_books ENABLE ROW LEVEL SECURITY;

-- RLS policies for fine_payments
CREATE POLICY "Members can view own payments"
ON public.fine_payments
FOR SELECT
USING (auth.uid() = member_id);

CREATE POLICY "Members can insert own payments"
ON public.fine_payments
FOR INSERT
WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Staff can view all payments"
ON public.fine_payments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'librarian'::app_role));

CREATE POLICY "Staff can manage payments"
ON public.fine_payments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'librarian'::app_role));

-- RLS policies for damaged_books
CREATE POLICY "Members can view own reports"
ON public.damaged_books
FOR SELECT
USING (auth.uid() = reported_by);

CREATE POLICY "Members can create reports"
ON public.damaged_books
FOR INSERT
WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Staff can view all damaged reports"
ON public.damaged_books
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'librarian'::app_role));

CREATE POLICY "Staff can manage damaged reports"
ON public.damaged_books
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'librarian'::app_role));

-- Create trigger for updated_at on damaged_books
CREATE TRIGGER update_damaged_books_updated_at
BEFORE UPDATE ON public.damaged_books
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();