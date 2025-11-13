import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDays } from "https://esm.sh/date-fns@3.6.0";

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

    // Verify user is admin or librarian
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isStaff = roles?.some(r => r.role === "admin" || r.role === "librarian");
    if (!isStaff) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Staff access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { request_id, status, reason } = await req.json();
    
    if (!request_id || !status || !["approved", "rejected"].includes(status)) {
      return new Response(
        JSON.stringify({ error: "Invalid request parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the renewal request with borrow record details
    const { data: renewalRequest, error: fetchError } = await supabase
      .from("renewal_requests")
      .select(`
        *,
        borrow_records (
          *,
          books (title, author)
        ),
        profiles!renewal_requests_member_id_fkey (email, full_name)
      `)
      .eq("id", request_id)
      .eq("status", "pending")
      .single();

    if (fetchError || !renewalRequest) {
      return new Response(
        JSON.stringify({ error: "Renewal request not found or already processed" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the renewal request
    const { error: updateRequestError } = await supabase
      .from("renewal_requests")
      .update({
        status,
        librarian_id: user.id,
        librarian_reason: reason || null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    if (updateRequestError) {
      console.error("Error updating renewal request:", updateRequestError);
      return new Response(
        JSON.stringify({ error: "Failed to process renewal request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let newDueDate = null;

    // If approved, update the borrow record
    if (status === "approved") {
      const currentDueDate = new Date(renewalRequest.borrow_records.due_date);
      newDueDate = addDays(currentDueDate, 14);

      const { error: updateBorrowError } = await supabase
        .from("borrow_records")
        .update({
          due_date: newDueDate.toISOString(),
          renewal_count: renewalRequest.borrow_records.renewal_count + 1,
        })
        .eq("id", renewalRequest.borrow_record_id);

      if (updateBorrowError) {
        console.error("Error updating borrow record:", updateBorrowError);
        return new Response(
          JSON.stringify({ error: "Failed to update borrow record" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create notification for the member
    const notificationMessage = status === "approved"
      ? `Your renewal request for "${renewalRequest.borrow_records.books.title}" has been approved. New due date: ${newDueDate?.toLocaleDateString()}`
      : `Your renewal request for "${renewalRequest.borrow_records.books.title}" has been rejected. ${reason ? `Reason: ${reason}` : ''}`;

    await supabase.from("notifications").insert({
      user_id: renewalRequest.member_id,
      type: status === "approved" ? "renewal_approved" : "renewal_rejected",
      title: status === "approved" ? "Renewal Request Approved" : "Renewal Request Rejected",
      message: notificationMessage,
      related_id: request_id,
    });

    console.log(`Renewal request ${status} by librarian ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        status,
        new_due_date: newDueDate?.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in process-renewal-request function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
