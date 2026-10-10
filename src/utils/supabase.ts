import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const collaborationRealtime=url&&key?createClient(url,key,{accessToken:async()=>auth.currentUser?.getIdToken()||null}):null;
