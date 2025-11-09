import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addDays, format } from "date-fns";

interface Book {
  id: string;
  title: string;
  author: string;
  available_copies: number;
}

interface Member {
  id: string;
  full_name: string;
  email: string;
  membership_plan_id: string;
  membership_plans: {
    max_books_allowed: number;
    name: string;
  };
}

export default function IssueBook() {
  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedBook, setSelectedBook] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [daysToLend, setDaysToLend] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userRole, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (userRole !== "admin" && userRole !== "librarian") {
      navigate("/");
      return;
    }
    fetchBooks();
    fetchMembers();
  }, [userRole, navigate]);

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from("books")
      .select("id, title, author, available_copies")
      .gt("available_copies", 0)
      .order("title");

    if (!error && data) {
      setBooks(data);
    }
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, membership_plan_id, membership_plans(max_books_allowed, name)")
      .not("membership_plan_id", "is", null)
      .order("full_name");

    if (!error && data) {
      setMembers(data as Member[]);
    }
  };

  const handleIssueBook = async () => {
    if (!selectedBook || !selectedMember) {
      toast({
        title: "Validation Error",
        description: "Please select both a book and a member",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Check current borrowed books count
      const { data: currentBorrows, error: countError } = await supabase
        .from("borrow_records")
        .select("id")
        .eq("member_id", selectedMember)
        .eq("status", "issued");

      if (countError) throw countError;

      const member = members.find((m) => m.id === selectedMember);
      const maxBooks = member?.membership_plans?.max_books_allowed || 3;

      if (currentBorrows && currentBorrows.length >= maxBooks) {
        toast({
          title: "Cannot Issue Book",
          description: `Member has reached maximum limit of ${maxBooks} books`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const issueDate = new Date();
      const dueDate = addDays(issueDate, daysToLend);

      const { error: insertError } = await supabase.from("borrow_records").insert({
        book_id: selectedBook,
        member_id: selectedMember,
        issue_date: issueDate.toISOString(),
        due_date: dueDate.toISOString(),
        issued_by: user?.id,
        status: "issued",
      });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Book issued successfully",
      });

      setSelectedBook("");
      setSelectedMember("");
      fetchBooks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to issue book",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Issue Book</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="member">Select Member</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email} ({member.membership_plans?.name || "No Plan"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="book">Select Book</Label>
              <Select value={selectedBook} onValueChange={setSelectedBook}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a book" />
                </SelectTrigger>
                <SelectContent>
                  {books.map((book) => (
                    <SelectItem key={book.id} value={book.id}>
                      {book.title} by {book.author} ({book.available_copies} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="days">Lending Period (Days)</Label>
              <Input
                id="days"
                type="number"
                min="1"
                max="90"
                value={daysToLend}
                onChange={(e) => setDaysToLend(parseInt(e.target.value) || 14)}
              />
              <p className="text-sm text-muted-foreground">
                Due date: {format(addDays(new Date(), daysToLend), "PPP")}
              </p>
            </div>

            <Button onClick={handleIssueBook} disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Issuing..." : "Issue Book"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
