-- Fix search_path for calculate_fine function
CREATE OR REPLACE FUNCTION public.calculate_fine(
  _due_date TIMESTAMP WITH TIME ZONE,
  _return_date TIMESTAMP WITH TIME ZONE,
  _fine_per_day NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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