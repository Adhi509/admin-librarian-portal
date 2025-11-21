import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  try {
    console.log('Starting daily notifications check...');

    // 1. Check for books due in 2 days and send reminders
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    twoDaysFromNow.setHours(23, 59, 59, 999);

    const { data: dueSoonBooks } = await supabase
      .from('borrow_records')
      .select(`
        id,
        due_date,
        member_id,
        books (title, author),
        profiles (email, full_name)
      `)
      .eq('status', 'issued')
      .lte('due_date', twoDaysFromNow.toISOString())
      .gte('due_date', new Date().toISOString());

    console.log(`Found ${dueSoonBooks?.length || 0} books due soon`);

    // Create notifications for due soon books
    if (dueSoonBooks && dueSoonBooks.length > 0) {
      for (const record of dueSoonBooks) {
        const book = record.books as any;
        
        await supabase.from('notifications').insert({
          user_id: record.member_id,
          type: 'due_soon',
          title: 'Book Due Soon',
          message: `"${book.title}" is due in 2 days (${new Date(record.due_date).toLocaleDateString()})`,
          related_id: record.id,
        });

        console.log(`Created due date notification for member ${record.member_id}`);
      }
    }

    // 2. Check for overdue books and send overdue alerts
    const { data: overdueBooks } = await supabase
      .from('borrow_records')
      .select(`
        id,
        due_date,
        member_id,
        fine_amount,
        books (title),
        profiles (email, full_name)
      `)
      .eq('status', 'issued')
      .lt('due_date', new Date().toISOString());

    console.log(`Found ${overdueBooks?.length || 0} overdue books`);

    if (overdueBooks && overdueBooks.length > 0) {
      for (const record of overdueBooks) {
        const book = record.books as any;
        
        await supabase.from('notifications').insert({
          user_id: record.member_id,
          type: 'overdue',
          title: 'Overdue Book Alert',
          message: `"${book.title}" is overdue. Fine: $${record.fine_amount || 0}`,
          related_id: record.id,
        });

        console.log(`Created overdue notification for member ${record.member_id}`);
      }
    }

    // 3. Check for low stock books (2 or fewer copies available)
    const { data: lowStockBooks } = await supabase
      .from('books')
      .select('id, title, available_copies')
      .lte('available_copies', 2)
      .gt('available_copies', 0);

    console.log(`Found ${lowStockBooks?.length || 0} low stock books`);

    if (lowStockBooks && lowStockBooks.length > 0) {
      // Get all admin and librarian users
      const { data: staffRoles } = await supabase
        .from('user_roles')
        .select('user_id, profiles (email, full_name)')
        .in('role', ['admin', 'librarian']);

      // Create notifications for each book and staff member
      for (const book of lowStockBooks) {
        if (staffRoles) {
          for (const role of staffRoles) {
            await supabase.from('notifications').insert({
              user_id: role.user_id,
              type: 'low_stock',
              title: 'Low Stock Alert',
              message: `"${book.title}" has only ${book.available_copies} copies available`,
              related_id: book.id,
            });
          }
        }
        console.log(`Created low stock notifications for "${book.title}"`);
      }
    }

    console.log('NOTE: Email functionality requires RESEND_API_KEY to be configured');
    console.log('Notifications have been created in the database and are visible in the Notifications page');

    return new Response(
      JSON.stringify({
        success: true,
        dueSoonCount: dueSoonBooks?.length || 0,
        overdueCount: overdueBooks?.length || 0,
        lowStockCount: lowStockBooks?.length || 0,
        note: 'Notifications created. Configure RESEND_API_KEY for email functionality.'
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in daily-notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
