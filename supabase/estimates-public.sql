-- Dane wyceny zapisane przez aplikację mobilną.
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS contractor JSONB,
  ADD COLUMN IF NOT EXISTS client JSONB,
  ADD COLUMN IF NOT EXISTS items JSONB,
  ADD COLUMN IF NOT EXISTS advance_percent NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Usuń wcześniejszą wersję funkcji, która zakładała, że id ma typ UUID.
DROP FUNCTION IF EXISTS public.get_public_estimate(UUID);
DROP FUNCTION IF EXISTS public.accept_public_estimate(UUID, TIMESTAMP WITH TIME ZONE);

-- Link klienta nie wymaga logowania, ale zwraca tylko wycenę wskazaną przez UUID.
CREATE OR REPLACE FUNCTION public.get_public_estimate(estimate_uuid TEXT)
RETURNS TABLE (
  id TEXT,
  estimate_number TEXT,
  contractor JSONB,
  client JSONB,
  items JSONB,
  advance_percent NUMERIC,
  status TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id::TEXT, e.estimate_number, e.contractor, e.client, e.items,
         e.advance_percent, e.status, e.accepted_at, e.created_at
  FROM public.estimates e
  WHERE e.id::TEXT = estimate_uuid;
$$;

CREATE OR REPLACE FUNCTION public.accept_public_estimate(
  estimate_uuid TEXT,
  accepted_at_value TIMESTAMP WITH TIME ZONE
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.estimates
  SET status = 'accepted', accepted_at = accepted_at_value
  WHERE id::TEXT = estimate_uuid;
$$;

REVOKE ALL ON FUNCTION public.get_public_estimate(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_estimate(TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_public_estimate(TEXT, TIMESTAMP WITH TIME ZONE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_public_estimate(TEXT, TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
