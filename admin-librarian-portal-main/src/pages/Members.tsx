import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, Calendar } from "lucide-react";

interface Member {
  id: string;
  email: string;
  full_name: string;
  membership_type: string;
  membership_start_date: string;
  phone: string;
  membership_plan_id: string | null;
  membership_plans: {
    name: string;
    annual_fee: number;
    max_books_allowed: number;
  } | null;
}

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole !== "admin" && userRole !== "librarian") {
      navigate("/");
      return;
    }
    fetchMembers();
  }, [userRole, navigate]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, membership_plans(name, annual_fee, max_books_allowed)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setMembers(data as Member[]);
    }
  };

  const filteredMembers = members.filter(
    (member) =>
      member.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Members</h1>
          <p className="text-muted-foreground">Manage library members</p>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member) => (
            <Card key={member.id}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span className="line-clamp-1">{member.full_name || "Unnamed Member"}</span>
                  <Badge variant="secondary">
                    {member.membership_plans?.name || member.membership_type || "No Plan"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{member.email}</span>
                </div>
                {member.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="truncate">{member.phone}</span>
                  </div>
                )}
                {member.membership_plans && (
                  <div className="space-y-1 pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Annual Fee:</span>
                      <span className="font-medium">₹{member.membership_plans.annual_fee}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Max Books:</span>
                      <span className="font-medium">{member.membership_plans.max_books_allowed}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Member since {new Date(member.membership_start_date).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No members found</p>
          </div>
        )}
      </div>
    </div>
  );
}