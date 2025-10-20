import { supabase as baseSupabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// Explicitly typed Supabase client wrapper
export const supabase = baseSupabase as SupabaseClient<Database>;
