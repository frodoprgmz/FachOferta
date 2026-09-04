import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Podmień te wartości na swoje dane z Panelu Supabase (Project Settings -> API)
const SUPABASE_URL = 'https://TWOJ-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'TWOJ-ANON-KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});