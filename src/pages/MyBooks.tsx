import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, BookOpen, AlertCircle } from "lucide-react";

interface BorrowRecord {
  id: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  fine_amount: number;
  books: {
    title: string;
    author: string;
  };
}

export default function MyBooks() {
  const [borrowRecords, setBorrowRecords] = useState<BorrowRecord[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchBorrowRecords();
    }
  }, [user]);

  const fetchBorrowRecords = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("borrow_records")
      .select(`
        id,
        issue_date,
        due_date,
        return_date,
        status,
        fine_amount,
        books (
          title,
          author
        )
      `)
      .eq("member_id", user.id)
      .order("issue_date", { ascending: false });

    if (!error && data) {
      setBorrowRecords(data as any);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "issued":
        return "default";
      case "returned":
        return "secondary";
      case "overdue":
        return "destructive";
      default:
        return "default";
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === "returned") return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Books</h1>
          <p className="text-muted-foreground">View your borrowed books and history</p>
        </div>

        <div className="space-y-4">
          {borrowRecords.map((record) => (
            <Card key={record.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="mb-1">{record.books.title}</CardTitle>
                    <CardDescription>by {record.books.author}</CardDescription>
                  </div>
                  <Badge variant={getStatusVariant(record.status)}>
                    {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Issued</p>
                      <p className="font-medium">
                        {new Date(record.issue_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Due Date</p>
                      <p className={`font-medium ${isOverdue(record.due_date, record.status) ? "text-destructive" : ""}`}>
                        {new Date(record.due_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {record.return_date ? (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Returned</p>
                        <p className="font-medium">
                          {new Date(record.return_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ) : isOverdue(record.due_date, record.status) ? (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <div>
                        <p className="font-medium">Overdue!</p>
                        <p className="text-xs">Please return soon</p>
                      </div>
                    </div>
                  ) : null}
                </div>
                {record.fine_amount > 0 && (
                  <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">
                      Fine Amount: ${record.fine_amount.toFixed(2)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {borrowRecords.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">You haven't borrowed any books yet</p>
          </div>
        )}
      </div>
    </div>
  );
}