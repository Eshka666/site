import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lwlerzyjqqnkhwrsqikw.supabase.co";

const supabaseAnonKey =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3bGVyenlqcXFua2h3cnNxaWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3MTI5NDksImV4cCI6MjA2OTI4ODk0OX0.cP1F45QwRO_lDb6_gof8k1VrFsgdz8p_1dsP2gcP9VI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);