import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";

interface MembershipPlan {
  id: string;
  name: string;
  duration_days: number;
  max_books_allowed: number;
  annual_fee: number;
  fine_per_day: number;
}

export default function MembershipPlans() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    duration_days: 365,
    max_books_allowed: 3,
    annual_fee: 0,
    fine_per_day: 5,
  });
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (userRole !== "admin") {
      navigate("/");
      return;
    }
    fetchPlans();
  }, [userRole, navigate]);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("membership_plans")
      .select("*")
      .order("annual_fee");

    if (!error && data) {
      setPlans(data);
    }
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Plan name is required",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("membership_plans").insert(formData);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Success", description: "Membership plan added" });
    setIsAddOpen(false);
    setFormData({
      name: "",
      duration_days: 365,
      max_books_allowed: 3,
      annual_fee: 0,
      fine_per_day: 5,
    });
    fetchPlans();
  };

  const handleEdit = async () => {
    if (!editingPlan) return;

    const { error } = await supabase
      .from("membership_plans")
      .update(formData)
      .eq("id", editingPlan.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Success", description: "Membership plan updated" });
    setIsEditOpen(false);
    setEditingPlan(null);
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;

    const { error } = await supabase.from("membership_plans").delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Success", description: "Membership plan deleted" });
    fetchPlans();
  };

  const openEditDialog = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      duration_days: plan.duration_days,
      max_books_allowed: plan.max_books_allowed,
      annual_fee: plan.annual_fee,
      fine_per_day: plan.fine_per_day,
    });
    setIsEditOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Membership Plans</h1>
            <p className="text-muted-foreground">Manage library membership plans and fees</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Membership Plan</DialogTitle>
                <DialogDescription>Create a new membership plan with custom settings</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Plan Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Premium"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (Days)</Label>
                  <Input
                    type="number"
                    value={formData.duration_days}
                    onChange={(e) =>
                      setFormData({ ...formData, duration_days: parseInt(e.target.value) || 365 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Books Allowed</Label>
                  <Input
                    type="number"
                    value={formData.max_books_allowed}
                    onChange={(e) =>
                      setFormData({ ...formData, max_books_allowed: parseInt(e.target.value) || 3 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Annual Fee (₹)</Label>
                  <Input
                    type="number"
                    value={formData.annual_fee}
                    onChange={(e) =>
                      setFormData({ ...formData, annual_fee: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fine Per Day (₹)</Label>
                  <Input
                    type="number"
                    value={formData.fine_per_day}
                    onChange={(e) =>
                      setFormData({ ...formData, fine_per_day: parseFloat(e.target.value) || 5 })
                    }
                  />
                </div>
                <Button onClick={handleAdd} className="w-full">
                  Add Plan
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>₹{plan.annual_fee}/year</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium">{plan.duration_days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Books:</span>
                    <span className="font-medium">{plan.max_books_allowed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fine/Day:</span>
                    <span className="font-medium">₹{plan.fine_per_day}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(plan)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(plan.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Membership Plan</DialogTitle>
              <DialogDescription>Update membership plan settings</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (Days)</Label>
                <Input
                  type="number"
                  value={formData.duration_days}
                  onChange={(e) =>
                    setFormData({ ...formData, duration_days: parseInt(e.target.value) || 365 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max Books Allowed</Label>
                <Input
                  type="number"
                  value={formData.max_books_allowed}
                  onChange={(e) =>
                    setFormData({ ...formData, max_books_allowed: parseInt(e.target.value) || 3 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Annual Fee (₹)</Label>
                <Input
                  type="number"
                  value={formData.annual_fee}
                  onChange={(e) =>
                    setFormData({ ...formData, annual_fee: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fine Per Day (₹)</Label>
                <Input
                  type="number"
                  value={formData.fine_per_day}
                  onChange={(e) =>
                    setFormData({ ...formData, fine_per_day: parseFloat(e.target.value) || 5 })
                  }
                />
              </div>
              <Button onClick={handleEdit} className="w-full">
                Update Plan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
