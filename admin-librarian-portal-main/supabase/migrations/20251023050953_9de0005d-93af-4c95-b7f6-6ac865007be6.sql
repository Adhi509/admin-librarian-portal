-- Block anonymous access to profiles table containing PII
-- This policy explicitly denies unauthenticated users from accessing sensitive member data
CREATE POLICY "Block anonymous access to profiles"
ON profiles
FOR SELECT
TO anon
USING (false);