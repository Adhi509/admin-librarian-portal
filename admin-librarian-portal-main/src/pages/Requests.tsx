import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";

interface ExtensionRequest {
  id: string;
  borrow_record_id: string;
  member_id: string;
  requested_days: number;
  reason: string;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
  borrow_records: {
    due_date: string;
    books: {
      title: string;
      author: string;
    };
  };
}

interface RenewalRequest {
  id: string;
  borrow_record_id: string;
  member_id: string;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
  borrow_records: {
    due_date: string;
    renewal_count: number;
    max_renewals: number;
    books: {
      title: string;
      author: string;
    };
  };
}

export default function Requests() {
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequest[]>([]);
  const [renewalRequests, setRenewalRequests] = useState<RenewalRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [requestType, setRequestType] = useState<"extension" | "renewal">("extension");
  const [actionType, setActionType] = useState<"approved" | "rejected">("approved");
  const [reason, setReason] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchExtensionRequests();
      fetchRenewalRequests();
    }
  }, [user]);

  const fetchExtensionRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("extension_requests")
        .select(`
          *,
          profiles!extension_requests_member_id_fkey (full_name, email),
          borrow_records (
            due_date,
            books (title, author)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExtensionRequests(data || []);
    } catch (error) {
      console.error("Error fetching extension requests:", error);
      toast.error("Failed to load extension requests");
    }
  };

  const fetchRenewalRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("renewal_requests")
        .select(`
          *,
          profiles!renewal_requests_member_id_fkey (full_name, email),
          borrow_records (
            due_date,
            renewal_count,
            max_renewals,
            books (title, author)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRenewalRequests(data || []);
    } catch (error) {
      console.error("Error fetching renewal requests:", error);
      toast.error("Failed to load renewal requests");
    }
  };

  const handleProcessRequest = async () => {
    if (!selectedRequest) return;

    try {
      setProcessingId(selectedRequest.id);

      const functionName = requestType === "extension" ? "process-extension-request" : "process-renewal-request";
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          request_id: selectedRequest.id,
          status: actionType,
          reason: reason || null,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Request ${actionType} successfully!`);
      setDialogOpen(false);
      setSelectedRequest(null);
      setReason("");
      
      if (requestType === "extension") {
        await fetchExtensionRequests();
      } else {
        await fetchRenewalRequests();
      }
    } catch (error: any) {
      console.error("Error processing request:", error);
      toast.error("Failed to process request");
    } finally {
      setProcessingId(null);
    }
  };

  const openDialog = (request: any, type: "extension" | "renewal", action: "approved" | "rejected") => {
    setSelectedRequest(request);
    setRequestType(type);
    setActionType(action);
    setDialogOpen(true);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Member Requests</h1>
          <p className="text-muted-foreground mt-2">
            Review and process extension and renewal requests from members
          </p>
        </div>

        <Tabs defaultValue="extension" className="space-y-4">
          <TabsList>
            <TabsTrigger value="extension">
              Extension Requests ({extensionRequests.filter(r => r.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="renewal">
              Renewal Requests ({renewalRequests.filter(r => r.status === "pending").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extension" className="space-y-4">
            {extensionRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{request.borrow_records.books.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        by {request.borrow_records.books.author}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(request.status)}>
                      {request.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Member</p>
                      <p className="text-muted-foreground">{request.profiles.full_name}</p>
                      <p className="text-muted-foreground text-xs">{request.profiles.email}</p>
                    </div>
                    <div>
                      <p className="font-medium">Current Due Date</p>
                      <p className="text-muted-foreground">
                        {new Date(request.borrow_records.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Requested Extension</p>
                      <p className="text-muted-foreground">{request.requested_days} days</p>
                    </div>
                    <div>
                      <p className="font-medium">Requested On</p>
                      <p className="text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-sm mb-1">Reason</p>
                    <p className="text-sm text-muted-foreground">{request.reason}</p>
                  </div>
                  {request.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openDialog(request, "extension", "approved")}
                        disabled={processingId === request.id}
                        size="sm"
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() => openDialog(request, "extension", "rejected")}
                        disabled={processingId === request.id}
                        variant="destructive"
                        size="sm"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {extensionRequests.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No extension requests found</p>
            )}
          </TabsContent>

          <TabsContent value="renewal" className="space-y-4">
            {renewalRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{request.borrow_records.books.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        by {request.borrow_records.books.author}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(request.status)}>
                      {request.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Member</p>
                      <p className="text-muted-foreground">{request.profiles.full_name}</p>
                      <p className="text-muted-foreground text-xs">{request.profiles.email}</p>
                    </div>
                    <div>
                      <p className="font-medium">Current Due Date</p>
                      <p className="text-muted-foreground">
                        {new Date(request.borrow_records.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Renewals Used</p>
                      <p className="text-muted-foreground">
                        {request.borrow_records.renewal_count} / {request.borrow_records.max_renewals}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Requested On</p>
                      <p className="text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">
                      If approved, due date will be extended by 14 days from the current due date.
                    </p>
                  </div>
                  {request.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openDialog(request, "renewal", "approved")}
                        disabled={processingId === request.id}
                        size="sm"
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() => openDialog(request, "renewal", "rejected")}
                        disabled={processingId === request.id}
                        variant="destructive"
                        size="sm"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {renewalRequests.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No renewal requests found</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approved" ? "Approve" : "Reject"} {requestType === "extension" ? "Extension" : "Renewal"} Request
            </DialogTitle>
            <DialogDescription>
              {actionType === "approved" 
                ? `Approve the ${requestType} request for "${selectedRequest?.borrow_records.books.title}"`
                : `Reject the ${requestType} request and provide a reason`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">
                {actionType === "approved" ? "Reason (Optional)" : "Reason for Rejection"}
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={actionType === "approved" 
                  ? "Optional note for the member"
                  : "Please provide a reason for rejection"
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDialogOpen(false);
              setReason("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleProcessRequest}
              disabled={processingId !== null || (actionType === "rejected" && !reason)}
              variant={actionType === "approved" ? "default" : "destructive"}
            >
              {processingId !== null ? "Processing..." : actionType === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
