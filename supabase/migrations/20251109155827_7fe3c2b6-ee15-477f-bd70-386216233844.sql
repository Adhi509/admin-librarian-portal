-- Create membership plans table
CREATE TABLE public.membership_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  duration_days INTEGER NOT NULL DEFAULT 365,
  max_books_allowed INTEGER NOT NULL DEFAULT 3,
  annual_fee NUMERIC NOT NULL DEFAULT 0,
  fine_per_day NUMERIC NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on membership_plans
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

-- Anyone can view membership plans
CREATE POLICY "Anyone can view membership plans"
ON public.membership_plans
FOR SELECT
USING (true);

-- Only admins can manage membership plans
CREATE POLICY "Admins can manage membership plans"
ON public.membership_plans
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Add membership_plan_id to profiles
ALTER TABLE public.profiles
ADD COLUMN membership_plan_id UUID REFERENCES public.membership_plans(id);

-- Insert default membership plans
INSERT INTO public.membership_plans (name, duration_days, max_books_allowed, annual_fee, fine_per_day)
VALUES 
  ('Basic', 365, 2, 0, 5),
  ('Standard', 365, 5, 500, 3),
  ('Premium', 365, 10, 1000, 2);

-- Create function to calculate fine
CREATE OR REPLACE FUNCTION public.calculate_fine(
  _due_date TIMESTAMP WITH TIME ZONE,
  _return_date TIMESTAMP WITH TIME ZONE,
  _fine_per_day NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  days_overdue INTEGER;
  fine_amount NUMERIC;
BEGIN
  -- If returned on time or before, no fine
  IF _return_date <= _due_date THEN
    RETURN 0;
  END IF;
  
  -- Calculate days overdue
  days_overdue := EXTRACT(DAY FROM (_return_date - _due_date));
  
  -- Calculate fine
  fine_amount := days_overdue * _fine_per_day;
  
  RETURN fine_amount;
END;
$$;

-- Add trigger to update membership plans updated_at
CREATE TRIGGER update_membership_plans_updated_at
BEFORE UPDATE ON public.membership_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();