// Deno Edge Function to provision or reset demo users
// Allows only predefined demo emails and sets their passwords
// Then ensures the correct role exists in public.user_roles
// Protected by shared secret authentication

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const demoProvisionSecret = Deno.env.get("DEMO_PROVISION_SECRET");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing required environment variables");
}

if (!demoProvisionSecret) {
  console.error("DEMO_PROVISION_SECRET not configured - endpoint will reject all requests");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const allowed = new Map<string, "admin" | "librarian">([
  ["admin@librario.com", "admin"],
  ["librarian@librario.com", "librarian"],
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Verify shared secret authentication
  const authHeader = req.headers.get("authorization");
  if (!demoProvisionSecret || authHeader !== `Bearer ${demoProvisionSecret}`) {
    console.warn("Unauthorized demo provision attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { email, password, full_name, role } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Missing email or password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const expectedRole = allowed.get(String(email).toLowerCase());
    if (!expectedRole || (role && role !== expectedRole)) {
      return new Response(
        JSON.stringify({ error: "Email not allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to find an existing user by email (supported in supabase-js v2.x)
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
      email,
    } as any);
    if (listErr) throw listErr;

    const existing = (list as any)?.users?.find((u: any) => u.email?.toLowerCase() === String(email).toLowerCase());

    let userId: string | undefined = existing?.id;

    if (existing) {
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password,
        user_metadata: { full_name },
      });
      if (updErr) throw updErr;
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) throw createErr;
      userId = created.user?.id;
    }

    // Ensure role exists
    if (userId) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: expectedRole }, { onConflict: "user_id,role" });
      if (roleErr && (roleErr as any).code !== "23505") throw roleErr;
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error
      ? e.message
      : (typeof e === "object" && e && "message" in (e as any) ? (e as any).message : String(e));
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
