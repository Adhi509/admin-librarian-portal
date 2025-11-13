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

    const { borrow_record_id } = await req.json();
    if (!borrow_record_id) {
      return new Response(
        JSON.stringify({ error: "Missing borrow_record_id" }),
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

    // Check if renewal is allowed
    if (record.renewal_count >= record.max_renewals) {
      return new Response(
        JSON.stringify({ error: `Maximum renewals (${record.max_renewals}) reached` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if book is overdue
    const now = new Date();
    const dueDate = new Date(record.due_date);
    if (now > dueDate) {
      return new Response(
        JSON.stringify({ error: "Cannot request renewal for overdue books" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if there's already a pending renewal request for this borrow record
    const { data: existingRequest } = await supabase
      .from("renewal_requests")
      .select("id")
      .eq("borrow_record_id", borrow_record_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      return new Response(
        JSON.stringify({ error: "A renewal request is already pending for this book" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the renewal request
    const { data: renewalRequest, error: insertError } = await supabase
      .from("renewal_requests")
      .insert({
        borrow_record_id,
        member_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating renewal request:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to submit renewal request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create notification for the member
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "renewal_requested",
      title: "Renewal Request Submitted",
      message: `Your renewal request for "${record.books.title}" has been submitted and is pending librarian approval.`,
      related_id: renewalRequest.id,
    });

    console.log(`Renewal request submitted successfully for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        request_id: renewalRequest.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in submit-renewal-request function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
