-- Real auth + profile lifecycle for Google login and admin manual subscription control.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  logo_url TEXT,
  bank_account TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired')),
  subscription_expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '14 days')
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_owner_access" ON public.profiles;
CREATE POLICY "profile_owner_access"
  ON public.profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    company_name,
    subscription_status,
    subscription_expires_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    '',
    'trial',
    NOW() + INTERVAL '14 days',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS TABLE (
  id UUID,
  email TEXT,
  company_name TEXT,
  subscription_status TEXT,
  subscription_expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(auth.jwt() ->> 'email', '')) <> 'protivwebdev@gmail.com' THEN
    RAISE EXCEPTION 'Admin access denied';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email::TEXT,
    p.company_name,
    p.subscription_status,
    p.subscription_expires_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_subscription(
  target_user_id UUID,
  new_status TEXT,
  new_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(auth.jwt() ->> 'email', '')) <> 'protivwebdev@gmail.com' THEN
    RAISE EXCEPTION 'Admin access denied';
  END IF;

  IF new_status NOT IN ('trial', 'active', 'expired') THEN
    RAISE EXCEPTION 'Invalid subscription status';
  END IF;

  UPDATE public.profiles
  SET
    subscription_status = new_status,
    subscription_expires_at = new_expires_at,
    updated_at = NOW()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_subscription(UUID, TEXT, TIMESTAMP WITH TIME ZONE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription(UUID, TEXT, TIMESTAMP WITH TIME ZONE) TO authenticated;
