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
import { DollarSign, Receipt } from "lucide-react";
import { format } from "date-fns";
import { Navbar } from "@/components/Navbar";

interface BorrowRecordWithFine {
  id: string;
  fine_amount: number;
  books: {
    title: string;
    author: string;
  };
  due_date: string;
  return_date: string | null;
}

interface FinePayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_reference: string;
  notes: string;
  borrow_records: {
    books: {
      title: string;
    };
  };
}

export default function FinePayments() {
  const [unpaidFines, setUnpaidFines] = useState<BorrowRecordWithFine[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<FinePayment[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<BorrowRecordWithFine | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchUnpaidFines();
    fetchPaymentHistory();
  }, []);

  const fetchUnpaidFines = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("borrow_records")
      .select(`
        id,
        fine_amount,
        due_date,
        return_date,
        books (title, author)
      `)
      .eq("member_id", user.id)
      .gt("fine_amount", 0)
      .order("due_date", { ascending: false });

    if (!error && data) {
      // Filter out records that have already been paid
      const { data: payments } = await supabase
        .from("fine_payments")
        .select("borrow_record_id")
        .eq("member_id", user.id);

      const paidRecordIds = new Set(payments?.map(p => p.borrow_record_id) || []);
      const unpaid = data.filter(record => !paidRecordIds.has(record.id));
      
      setUnpaidFines(unpaid as any);
    }
  };

  const fetchPaymentHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("fine_payments")
      .select(`
        id,
        amount,
        payment_date,
        payment_method,
        transaction_reference,
        notes,
        borrow_records (
          books (title)
        )
      `)
      .eq("member_id", user.id)
      .order("payment_date", { ascending: false });

    if (!error && data) {
      setPaymentHistory(data as any);
    }
  };

  const handlePayFine = async () => {
    if (!selectedRecord) return;

    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to pay fines");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("fine_payments").insert({
      member_id: user.id,
      borrow_record_id: selectedRecord.id,
      amount: selectedRecord.fine_amount,
      payment_method: paymentMethod,
      transaction_reference: transactionRef,
      notes: notes,
    });

    setIsSubmitting(false);

    if (error) {
      toast.error("Failed to record payment");
      console.error(error);
      return;
    }

    toast.success("Payment recorded successfully");
    setDialogOpen(false);
    setPaymentMethod("cash");
    setTransactionRef("");
    setNotes("");
    setSelectedRecord(null);
    fetchUnpaidFines();
    fetchPaymentHistory();
  };

  const totalUnpaidFines = unpaidFines.reduce((sum, record) => sum + Number(record.fine_amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Fine Payments</h1>
            <p className="text-muted-foreground">Manage and pay your library fines</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Unpaid</p>
                  <p className="text-2xl font-bold">${totalUnpaidFines.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unpaid Fines */}
        <Card>
          <CardHeader>
            <CardTitle>Unpaid Fines</CardTitle>
            <CardDescription>Outstanding fines that need to be paid</CardDescription>
          </CardHeader>
          <CardContent>
            {unpaidFines.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No unpaid fines</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Book</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Fine Amount</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaidFines.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.books.title}</TableCell>
                      <TableCell>{record.books.author}</TableCell>
                      <TableCell>{format(new Date(record.due_date), "PP")}</TableCell>
                      <TableCell className="text-destructive font-semibold">
                        ${Number(record.fine_amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Dialog open={dialogOpen && selectedRecord?.id === record.id} onOpenChange={(open) => {
                          setDialogOpen(open);
                          if (!open) setSelectedRecord(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setSelectedRecord(record);
                                setDialogOpen(true);
                              }}
                            >
                              Pay Fine
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Pay Fine</DialogTitle>
                              <DialogDescription>
                                Record payment for "{record.books.title}"
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Amount to Pay</Label>
                                <Input 
                                  value={`$${Number(record.fine_amount).toFixed(2)}`} 
                                  disabled 
                                />
                              </div>
                              <div>
                                <Label htmlFor="payment-method">Payment Method</Label>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                  <SelectTrigger id="payment-method">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="card">Card</SelectItem>
                                    <SelectItem value="upi">UPI</SelectItem>
                                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="transaction-ref">Transaction Reference (Optional)</Label>
                                <Input 
                                  id="transaction-ref"
                                  value={transactionRef}
                                  onChange={(e) => setTransactionRef(e.target.value)}
                                  placeholder="e.g., Receipt #123, UTR number"
                                />
                              </div>
                              <div>
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea 
                                  id="notes"
                                  value={notes}
                                  onChange={(e) => setNotes(e.target.value)}
                                  placeholder="Additional notes..."
                                />
                              </div>
                              <Button 
                                onClick={handlePayFine} 
                                disabled={isSubmitting}
                                className="w-full"
                              >
                                {isSubmitting ? "Recording..." : "Record Payment"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Payment History
            </CardTitle>
            <CardDescription>Record of all fine payments</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No payment history</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Book</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{format(new Date(payment.payment_date), "PPp")}</TableCell>
                      <TableCell>{payment.borrow_records?.books?.title || "N/A"}</TableCell>
                      <TableCell className="font-semibold">${Number(payment.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.payment_method}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.transaction_reference || "—"}
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
