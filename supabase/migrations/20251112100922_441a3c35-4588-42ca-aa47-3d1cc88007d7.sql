-- Add renewal tracking to borrow_records
ALTER TABLE public.borrow_records
ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_renewals INTEGER DEFAULT 2;

-- Add book damage tracking
ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';

-- Drop existing constraint if exists and recreate
DO $$ BEGIN
  ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_status_check;
  ALTER TABLE public.books ADD CONSTRAINT books_status_check CHECK (status IN ('available', 'damaged', 'maintenance'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Drop existing constraint if exists and recreate
DO $$ BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('due_reminder', 'overdue', 'reservation', 'low_stock', 'damaged_book', 'renewal_approved'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Recreate policies
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all notifications"
ON public.notifications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'librarian'::app_role));

CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create reservations table
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reserved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active',
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Drop existing constraint if exists and recreate
DO $$ BEGIN
  ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
  ALTER TABLE public.reservations ADD CONSTRAINT reservations_status_check 
    CHECK (status IN ('active', 'fulfilled', 'expired', 'cancelled'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Enable RLS on reservations
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Members can view own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can manage reservations" ON public.reservations;
DROP POLICY IF EXISTS "Members can create own reservations" ON public.reservations;

-- Recreate policies
CREATE POLICY "Members can view own reservations"
ON public.reservations
FOR SELECT
USING (auth.uid() = member_id);

CREATE POLICY "Staff can manage reservations"
ON public.reservations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'librarian'::app_role));

CREATE POLICY "Members can create own reservations"
ON public.reservations
FOR INSERT
WITH CHECK (auth.uid() = member_id);

-- Add trigger for updated_at on notifications if not exists
DROP TRIGGER IF EXISTS update_notifications_updated_at ON public.notifications;
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications (wrapped to handle if already exists)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);