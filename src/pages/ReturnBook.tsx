import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, differenceInDays } from "date-fns";
import { AlertCircle, CheckCircle } from "lucide-react";

interface BorrowRecord {
  id: string;
  issue_date: string;
  due_date: string;
  books: {
    title: string;
    author: string;
  };
  profiles: {
    full_name: string;
    email: string;
    membership_plans: {
      fine_per_day: number;
    };
  };
}

export default function ReturnBook() {
  const [borrowRecords, setBorrowRecords] = useState<BorrowRecord[]>([]);
  const [returningId, setReturningId] = useState<string | null>(null);
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (userRole !== "admin" && userRole !== "librarian") {
      navigate("/");
      return;
    }
    fetchIssuedBooks();
  }, [userRole, navigate]);

  const fetchIssuedBooks = async () => {
    const { data: records, error } = await supabase
      .from("borrow_records")
      .select("id, issue_date, due_date, book_id, member_id")
      .eq("status", "issued")
      .order("due_date");

    if (error || !records) {
      return;
    }

    // Fetch related data separately
    const bookIds = records.map(r => r.book_id);
    const memberIds = records.map(r => r.member_id);

    const [booksRes, profilesRes] = await Promise.all([
      supabase.from("books").select("id, title, author").in("id", bookIds),
      supabase.from("profiles").select("id, full_name, email, membership_plan_id").in("id", memberIds)
    ]);

    const { data: plansData } = await supabase
      .from("membership_plans")
      .select("id, fine_per_day");

    // Create lookup maps
    const booksMap = new Map(booksRes.data?.map(b => [b.id, b]) || []);
    const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]) || []);
    const plansMap = new Map(plansData?.map(p => [p.id, p]) || []);

    // Combine the data
    const combined = records.map(record => {
      const book = booksMap.get(record.book_id);
      const profile = profilesMap.get(record.member_id);
      const plan = profile?.membership_plan_id ? plansMap.get(profile.membership_plan_id) : null;

      return {
        id: record.id,
        issue_date: record.issue_date,
        due_date: record.due_date,
        books: {
          title: book?.title || "Unknown",
          author: book?.author || "Unknown"
        },
        profiles: {
          full_name: profile?.full_name || "",
          email: profile?.email || "",
          membership_plans: {
            fine_per_day: plan?.fine_per_day || 5
          }
        }
      };
    });

    setBorrowRecords(combined as BorrowRecord[]);
  };

  const calculateFine = (dueDate: string, finePerDay: number) => {
    const due = new Date(dueDate);
    const now = new Date();
    
    if (!isPast(due)) return 0;
    
    const daysOverdue = differenceInDays(now, due);
    return daysOverdue * finePerDay;
  };

  const handleReturn = async (recordId: string, dueDate: string, finePerDay: number) => {
    setReturningId(recordId);

    try {
      const returnDate = new Date();
      const fine = calculateFine(dueDate, finePerDay);

      const { error } = await supabase
        .from("borrow_records")
        .update({
          status: "returned",
          return_date: returnDate.toISOString(),
          fine_amount: fine,
        })
        .eq("id", recordId);

      if (error) throw error;

      toast({
        title: "Success",
        description: fine > 0 
          ? `Book returned. Fine: ₹${fine.toFixed(2)}`
          : "Book returned on time",
      });

      fetchIssuedBooks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to return book",
        variant: "destructive",
      });
    } finally {
      setReturningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Return Book</h1>
          <p className="text-muted-foreground">Process book returns and calculate fines</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {borrowRecords.map((record) => {
            const isOverdue = isPast(new Date(record.due_date));
            const fine = calculateFine(
              record.due_date,
              record.profiles.membership_plans?.fine_per_day || 5
            );

            return (
              <Card key={record.id} className={isOverdue ? "border-destructive" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle>{record.books.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">by {record.books.author}</p>
                    </div>
                    {isOverdue ? (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Overdue
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        On Time
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Borrowed By</p>
                      <p className="font-medium">
                        {record.profiles.full_name || record.profiles.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Issue Date</p>
                      <p className="font-medium">{format(new Date(record.issue_date), "PPP")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Due Date</p>
                      <p className="font-medium">{format(new Date(record.due_date), "PPP")}</p>
                    </div>
                    {fine > 0 && (
                      <div>
                        <p className="text-muted-foreground">Fine Amount</p>
                        <p className="font-bold text-destructive">₹{fine.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() =>
                      handleReturn(
                        record.id,
                        record.due_date,
                        record.profiles.membership_plans?.fine_per_day || 5
                      )
                    }
                    disabled={returningId === record.id}
                    className="w-full"
                  >
                    {returningId === record.id ? "Processing..." : "Return Book"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {borrowRecords.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No books currently issued</p>
          </div>
        )}
      </div>
    </div>
  );
}
