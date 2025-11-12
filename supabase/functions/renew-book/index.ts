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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { borrow_id } = await req.json();
    if (!borrow_id) {
      return new Response(
        JSON.stringify({ error: "Missing borrow_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the borrow record
    const { data: record, error: fetchError } = await supabase
      .from("borrow_records")
      .select("*, books(*)")
      .eq("id", borrow_id)
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

    // Check if overdue
    const now = new Date();
    const dueDate = new Date(record.due_date);
    if (now > dueDate) {
      return new Response(
        JSON.stringify({ error: "Cannot renew overdue books" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate new due date (extend by 14 days from current due date)
    const newDueDate = addDays(dueDate, 14);

    // Update the borrow record
    const { error: updateError } = await supabase
      .from("borrow_records")
      .update({
        due_date: newDueDate.toISOString(),
        renewal_count: record.renewal_count + 1,
      })
      .eq("id", borrow_id);

    if (updateError) {
      console.error("Error updating borrow record:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to renew book" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create notification
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "renewal_approved",
      title: "Book Renewal Approved",
      message: `Your book "${record.books.title}" has been renewed. New due date: ${newDueDate.toLocaleDateString()}`,
      related_id: borrow_id,
    });

    console.log(`Book renewed successfully for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        new_due_date: newDueDate.toISOString(),
        renewals_remaining: record.max_renewals - (record.renewal_count + 1),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in renew-book function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});