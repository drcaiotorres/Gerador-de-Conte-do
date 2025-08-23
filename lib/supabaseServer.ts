
import { createClient } from "@supabase/supabase-js";
export const supabaseServer = () => {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
};
