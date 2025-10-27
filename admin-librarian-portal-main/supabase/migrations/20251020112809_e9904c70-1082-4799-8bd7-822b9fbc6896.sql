-- Update handle_new_user to assign roles based on email and ensure profile creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Create profile row
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  -- Assign role based on email
  insert into public.user_roles (user_id, role)
  values (
    new.id,
    case
      when lower(new.email) = 'admin@librario.com' then 'admin'::app_role
      when lower(new.email) = 'librarian@librario.com' then 'librarian'::app_role
      else 'member'::app_role
    end
  )
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- Create trigger if it doesn't exist to run after a user is created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Backfill roles if these users already exist
update public.user_roles ur
set role = 'admin'::app_role
from auth.users u
where ur.user_id = u.id and lower(u.email) = 'admin@librario.com';

update public.user_roles ur
set role = 'librarian'::app_role
from auth.users u
where ur.user_id = u.id and lower(u.email) = 'librarian@librario.com';