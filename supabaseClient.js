import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = "https://bpdoddqfwsjfvwvvtadt.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZG9kZHFmd3NqZnZ3dnZ0YWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTkyMDQsImV4cCI6MjA3MTg3NTIwNH0.jkO66zvdjbKko5XewXEqtExZeyQx6A_xAZv09e_7CCI";

export const supabase = createClient(supabaseUrl, supabaseKey);
