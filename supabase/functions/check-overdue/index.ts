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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    console.log("Running overdue check...");

    // Find books that are overdue
    const { data: overdueBooks, error: overdueError } = await supabase
      .from("borrow_records")
      .select("*, books(*), profiles(*), membership_plans:profiles(membership_plans(*))")
      .eq("status", "issued")
      .lt("due_date", now.toISOString());

    if (overdueError) {
      console.error("Error fetching overdue books:", overdueError);
    } else if (overdueBooks && overdueBooks.length > 0) {
      console.log(`Found ${overdueBooks.length} overdue books`);
      
      // Create notifications for overdue books
      for (const record of overdueBooks) {
        const daysOverdue = Math.floor((now.getTime() - new Date(record.due_date).getTime()) / (1000 * 60 * 60 * 24));
        
        await supabase.from("notifications").insert({
          user_id: record.member_id,
          type: "overdue",
          title: "Book Overdue",
          message: `Your book "${record.books.title}" is ${daysOverdue} day(s) overdue. Please return it to avoid additional fines.`,
          related_id: record.id,
        });
      }
    }

    // Find books due in 2 days (for reminders)
    const { data: upcomingBooks, error: upcomingError } = await supabase
      .from("borrow_records")
      .select("*, books(*)")
      .eq("status", "issued")
      .gte("due_date", now.toISOString())
      .lte("due_date", twoDaysFromNow.toISOString());

    if (upcomingError) {
      console.error("Error fetching upcoming due books:", upcomingError);
    } else if (upcomingBooks && upcomingBooks.length > 0) {
      console.log(`Found ${upcomingBooks.length} books due soon`);
      
      // Create notifications for upcoming due dates
      for (const record of upcomingBooks) {
        const dueDate = new Date(record.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        await supabase.from("notifications").insert({
          user_id: record.member_id,
          type: "due_reminder",
          title: "Book Due Soon",
          message: `Your book "${record.books.title}" is due in ${daysUntilDue} day(s). Due date: ${dueDate.toLocaleDateString()}`,
          related_id: record.id,
        });
      }
    }

    // Check for low stock books (less than 3 copies available)
    const { data: lowStockBooks, error: stockError } = await supabase
      .from("books")
      .select("*")
      .lt("available_copies", 3)
      .gt("available_copies", 0);

    if (stockError) {
      console.error("Error fetching low stock books:", stockError);
    } else if (lowStockBooks && lowStockBooks.length > 0) {
      console.log(`Found ${lowStockBooks.length} low stock books`);
      
      // Get all admin users
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (admins) {
        for (const book of lowStockBooks) {
          for (const admin of admins) {
            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              type: "low_stock",
              title: "Low Stock Alert",
              message: `Book "${book.title}" has only ${book.available_copies} cop${book.available_copies === 1 ? 'y' : 'ies'} available.`,
              related_id: book.id,
            });
          }
        }
      }
    }

    console.log("Overdue check completed successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        overdue_count: overdueBooks?.length || 0,
        upcoming_count: upcomingBooks?.length || 0,
        low_stock_count: lowStockBooks?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-overdue function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});