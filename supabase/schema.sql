-- 1. Tabela profili użytkowników (Fachowców)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  logo_url TEXT,
  bank_account TEXT, -- Numer konta na ofertach
  
  -- Model Subskrypcji (Ręczny/BLIK)
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired')),
  subscription_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days') -- 14 dni darmowego trialu
);

-- 2. Tabela Klientów (Klienci fachowca)
CREATE TABLE public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT
);

-- 3. Tabela Cennika (Własne pozycje/usługi fachowca)
CREATE TABLE public.price_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'm2', -- np. m2, szt., mb, godz.
  default_price_net NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  vat_rate NUMERIC(4, 2) DEFAULT 23.00
);

-- 4. Tabela Wycen / Nagłówków Ofert
CREATE TABLE public.estimates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  estimate_number TEXT NOT NULL, -- np. WYC/2026/09/01
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  
  total_net NUMERIC(10, 2) DEFAULT 0.00,
  total_gross NUMERIC(10, 2) DEFAULT 0.00,
  advance_percentage NUMERIC(5, 2) DEFAULT 0.00, -- % zaliczki
  
  signature_url TEXT, -- Link do zapisanego obrazu podpisu
  notes TEXT -- Dodatkowe ustalenia w stopce
);

-- 5. Tabela Pozycji w danej Wycenie
CREATE TABLE public.estimate_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID REFERENCES public.estimates(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  unit_price_net NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  vat_rate NUMERIC(4, 2) DEFAULT 23.00,
  total_net NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- ==========================================
-- BEZPIECZEŃSTWO (Row Level Security - RLS)
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;

-- Polityki: Użytkownik ma dostęp TYLKO do swoich danych
CREATE POLICY "Dostęp do własnego profilu" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Dostęp do własnych klientów" ON public.clients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Dostęp do własnego cennika" ON public.price_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Dostęp do własnych wycen" ON public.estimates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Dostęp do pozycji własnych wycen" ON public.estimate_items FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.estimates WHERE estimates.id = estimate_items.estimate_id AND estimates.user_id = auth.uid()));