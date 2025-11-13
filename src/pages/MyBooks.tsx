import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, BookOpen, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BorrowRecord {
  id: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  fine_amount: number;
  renewal_count: number;
  max_renewals: number;
  books: {
    title: string;
    author: string;
  };
}

export default function MyBooks() {
  const [borrowRecords, setBorrowRecords] = useState<BorrowRecord[]>([]);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BorrowRecord | null>(null);
  const [extensionDays, setExtensionDays] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

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
        renewal_count,
        max_renewals,
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

  const handleRequestRenewal = async () => {
    if (!selectedRecord) return;

    try {
      setRenewingId(selectedRecord.id);
      
      const { data, error } = await supabase.functions.invoke("submit-renewal-request", {
        body: { borrow_record_id: selectedRecord.id },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Request Failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Renewal Request Submitted",
        description: "Your renewal request has been submitted and is pending librarian approval.",
      });
      
      setRenewalDialogOpen(false);
      setSelectedRecord(null);
      await fetchBorrowRecords();
    } catch (error: any) {
      console.error("Error submitting renewal request:", error);
      toast({
        title: "Request Failed",
        description: "Failed to submit renewal request",
        variant: "destructive",
      });
    } finally {
      setRenewingId(null);
    }
  };

  const handleRequestExtension = async () => {
    if (!selectedRecord || !extensionDays || !extensionReason) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const days = parseInt(extensionDays);
    if (isNaN(days) || days <= 0 || days > 30) {
      toast({
        title: "Invalid Days",
        description: "Extension days must be between 1 and 30",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("submit-extension-request", {
        body: {
          borrow_record_id: selectedRecord.id,
          requested_days: days,
          reason: extensionReason,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Request Failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Extension Request Submitted",
        description: "Your extension request has been submitted and is pending librarian approval.",
      });
      
      setExtensionDialogOpen(false);
      setSelectedRecord(null);
      setExtensionDays("");
      setExtensionReason("");
      await fetchBorrowRecords();
    } catch (error: any) {
      console.error("Error submitting extension request:", error);
      toast({
        title: "Request Failed",
        description: "Failed to submit extension request",
        variant: "destructive",
      });
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
                    <CardDescription>{record.books.author}</CardDescription>
                  </div>
                  <Badge variant={getStatusVariant(record.status)}>
                    {isOverdue(record.due_date, record.status) ? "Overdue" : record.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Issue Date:</span>
                      <span className="font-medium">
                        {new Date(record.issue_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Due Date:</span>
                      <span className={`font-medium ${isOverdue(record.due_date, record.status) ? 'text-destructive' : ''}`}>
                        {new Date(record.due_date).toLocaleDateString()}
                      </span>
                    </div>
                    {record.return_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Return Date:</span>
                        <span className="font-medium">
                          {new Date(record.return_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {isOverdue(record.due_date, record.status) && (
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive text-sm">Overdue!</p>
                        <p className="text-sm text-muted-foreground">
                          Please return this book as soon as possible.
                        </p>
                      </div>
                    </div>
                  )}

                  {record.fine_amount > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                      <p className="text-sm">
                        <span className="font-medium">Fine Amount:</span> ₹{record.fine_amount.toFixed(2)}
                      </p>
                    </div>
                  )}

                  {record.status === "issued" && !isOverdue(record.due_date, record.status) && (
                    <div className="flex gap-2">
                      {record.renewal_count < record.max_renewals && (
                        <Button
                          onClick={() => {
                            setSelectedRecord(record);
                            setRenewalDialogOpen(true);
                          }}
                          disabled={renewingId === record.id}
                          size="sm"
                          variant="default"
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Request Renewal ({record.max_renewals - record.renewal_count} left)
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          setSelectedRecord(record);
                          setExtensionDialogOpen(true);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Request Extension
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {borrowRecords.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">You haven't borrowed any books yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={renewalDialogOpen} onOpenChange={setRenewalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Book Renewal</DialogTitle>
            <DialogDescription>
              Submit a renewal request for "{selectedRecord?.books.title}". 
              A librarian will review your request and notify you of their decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              If approved, your due date will be extended by 14 days from the current due date.
            </p>
            <p className="text-sm">
              <strong>Current Due Date:</strong> {selectedRecord?.due_date ? new Date(selectedRecord.due_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestRenewal} disabled={renewingId !== null}>
              {renewingId !== null ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extensionDialogOpen} onOpenChange={setExtensionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Due Date Extension</DialogTitle>
            <DialogDescription>
              Request an extension for "{selectedRecord?.books.title}". 
              A librarian will review your request and notify you of their decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="extension-days">Number of Days (1-30)</Label>
              <Input
                id="extension-days"
                type="number"
                min="1"
                max="30"
                value={extensionDays}
                onChange={(e) => setExtensionDays(e.target.value)}
                placeholder="Enter number of days"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extension-reason">Reason for Extension</Label>
              <Textarea
                id="extension-reason"
                value={extensionReason}
                onChange={(e) => setExtensionReason(e.target.value)}
                placeholder="Please provide a reason for your extension request"
                rows={4}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Current Due Date:</strong> {selectedRecord?.due_date ? new Date(selectedRecord.due_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setExtensionDialogOpen(false);
              setExtensionDays("");
              setExtensionReason("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleRequestExtension}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
