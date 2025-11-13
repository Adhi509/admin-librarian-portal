import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { borrow_record_id, requested_days, reason } = await req.json();
    
    if (!borrow_record_id || !requested_days || !reason) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (requested_days <= 0 || requested_days > 30) {
      return new Response(
        JSON.stringify({ error: "Requested days must be between 1 and 30" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the borrow record exists and belongs to the user
    const { data: record, error: fetchError } = await supabase
      .from("borrow_records")
      .select("*, books(*)")
      .eq("id", borrow_record_id)
      .eq("member_id", user.id)
      .eq("status", "issued")
      .single();

    if (fetchError || !record) {
      return new Response(
        JSON.stringify({ error: "Borrow record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if there's already a pending extension request for this borrow record
    const { data: existingRequest } = await supabase
      .from("extension_requests")
      .select("id")
      .eq("borrow_record_id", borrow_record_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      return new Response(
        JSON.stringify({ error: "An extension request is already pending for this book" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the extension request
    const { data: extensionRequest, error: insertError } = await supabase
      .from("extension_requests")
      .insert({
        borrow_record_id,
        member_id: user.id,
        requested_days,
        reason,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating extension request:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to submit extension request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create notification for the member
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "extension_requested",
      title: "Extension Request Submitted",
      message: `Your extension request for "${record.books.title}" (${requested_days} days) has been submitted and is pending librarian approval.`,
      related_id: extensionRequest.id,
    });

    console.log(`Extension request submitted successfully for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        request_id: extensionRequest.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in submit-extension-request function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
