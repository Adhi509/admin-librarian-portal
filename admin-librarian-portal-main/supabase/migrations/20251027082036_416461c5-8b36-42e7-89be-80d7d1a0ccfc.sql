-- Allow members to insert their own borrow records
CREATE POLICY "Members can insert own borrow records"
ON public.borrow_records
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = member_id);