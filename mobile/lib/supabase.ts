import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nufqvbubofjsbqijclci.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51ZnF2YnVib2Zqc2JxaWpjbGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MTQzOTQsImV4cCI6MjEwNDA5MDM5NH0.AhfTWekCGKcxpAtp-QL-UuxBp0pUjhFekueg4gzMX1k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});