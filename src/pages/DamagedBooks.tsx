import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Navbar } from "@/components/Navbar";

interface Book {
  id: string;
  title: string;
  author: string;
}

interface DamagedBookReport {
  id: string;
  book_id: string;
  damage_description: string;
  severity: string;
  status: string;
  report_date: string;
  books: {
    title: string;
    author: string;
  };
}

export default function DamagedBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [reports, setReports] = useState<DamagedBookReport[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [damageDescription, setDamageDescription] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetchUserRole();
    fetchBooks();
    fetchReports();
  }, []);

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setUserRole(data.role);
    }
  };

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from("books")
      .select("id, title, author")
      .order("title");

    if (!error && data) {
      setBooks(data);
    }
  };

  const fetchReports = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isStaff = roles?.some(r => r.role === 'admin' || r.role === 'librarian');

    let query = supabase
      .from("damaged_books")
      .select(`
        id,
        book_id,
        damage_description,
        severity,
        status,
        report_date,
        books (title, author)
      `)
      .order("report_date", { ascending: false });

    if (!isStaff) {
      query = query.eq("reported_by", user.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      setReports(data as any);
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedBookId || !damageDescription) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("damaged_books").insert({
      book_id: selectedBookId,
      reported_by: user.id,
      damage_description: damageDescription,
      severity: severity,
    });

    setIsSubmitting(false);

    if (error) {
      toast.error("Failed to submit report");
      console.error(error);
      return;
    }

    toast.success("Damage report submitted successfully");
    setDialogOpen(false);
    setSelectedBookId("");
    setDamageDescription("");
    setSeverity("minor");
    fetchReports();

    // Create notification for admins
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRoles) {
      const book = books.find(b => b.id === selectedBookId);
      for (const role of adminRoles) {
        await supabase.from("notifications").insert({
          user_id: role.user_id,
          type: "damaged_book",
          title: "New Damaged Book Report",
          message: `A damage report has been submitted for "${book?.title}"`,
          related_id: selectedBookId,
        });
      }
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "minor": return "default";
      case "moderate": return "secondary";
      case "severe": return "destructive";
      default: return "default";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "reported": return "secondary";
      case "under_review": return "default";
      case "resolved": return "outline";
      default: return "default";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Damaged Books</h1>
            <p className="text-muted-foreground">Report and track damaged book records</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Report Damaged Book
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report Damaged Book</DialogTitle>
                <DialogDescription>
                  Submit a report for a damaged book
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="book">Book</Label>
                  <Select value={selectedBookId} onValueChange={setSelectedBookId}>
                    <SelectTrigger id="book">
                      <SelectValue placeholder="Select a book" />
                    </SelectTrigger>
                    <SelectContent>
                      {books.map((book) => (
                        <SelectItem key={book.id} value={book.id}>
                          {book.title} by {book.author}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="severity">Severity</Label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger id="severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minor">Minor</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Damage Description</Label>
                  <Textarea 
                    id="description"
                    value={damageDescription}
                    onChange={(e) => setDamageDescription(e.target.value)}
                    placeholder="Describe the damage in detail..."
                    rows={4}
                  />
                </div>
                <Button 
                  onClick={handleSubmitReport} 
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Damage Reports</CardTitle>
            <CardDescription>
              {userRole === 'admin' || userRole === 'librarian' 
                ? "All damage reports" 
                : "Your damage reports"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No damage reports</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Book</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>{format(new Date(report.report_date), "PP")}</TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div>{report.books.title}</div>
                          <div className="text-sm text-muted-foreground">{report.books.author}</div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{report.damage_description}</TableCell>
                      <TableCell>
                        <Badge variant={getSeverityColor(report.severity)}>
                          {report.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(report.status)}>
                          {report.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
