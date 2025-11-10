import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface BorrowHistory {
  id: string;
  book_id: string;
  member_id: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  book_title?: string;
  member_name?: string;
  member_email?: string;
}

export default function UserHistory() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<BorrowHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole !== "admin" && userRole !== "librarian") {
      navigate("/");
      return;
    }
    fetchHistory();
  }, [userRole, navigate]);

  const fetchHistory = async () => {
    try {
      // Fetch borrow records with book and member details
      const { data: borrowData, error: borrowError } = await supabase
        .from("borrow_records")
        .select("*")
        .order("issue_date", { ascending: false });

      if (borrowError) throw borrowError;

      // Fetch books
      const { data: booksData, error: booksError } = await supabase
        .from("books")
        .select("id, title");

      if (booksError) throw booksError;

      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email");

      if (profilesError) throw profilesError;

      // Combine data
      const combinedHistory: BorrowHistory[] = borrowData.map((record) => {
        const book = booksData.find((b) => b.id === record.book_id);
        const profile = profilesData.find((p) => p.id === record.member_id);
        
        return {
          ...record,
          book_title: book?.title || "Unknown Book",
          member_name: profile?.full_name || "Unknown User",
          member_email: profile?.email || "",
        };
      });

      setHistory(combinedHistory);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">User Borrow History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading history...</p>
            ) : history.length === 0 ? (
              <p className="text-muted-foreground">No borrow history found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Book</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.member_name}</TableCell>
                        <TableCell>{record.member_email}</TableCell>
                        <TableCell>{record.book_title}</TableCell>
                        <TableCell>
                          {format(new Date(record.issue_date), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.due_date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              record.status === "issued"
                                ? "bg-primary/10 text-primary"
                                : "bg-secondary/10 text-secondary-foreground"
                            }`}
                          >
                            {record.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
