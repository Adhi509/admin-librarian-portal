import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, BookMarked, TrendingUp } from "lucide-react";

interface Stats {
  totalBooks: number;
  totalMembers: number;
  activeLoans: number;
  overdueBooks: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalBooks: 0,
    totalMembers: 0,
    activeLoans: 0,
    overdueBooks: 0,
  });
  const { userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole !== "admin" && userRole !== "librarian") {
      navigate("/");
      return;
    }
    fetchStats();
  }, [userRole, navigate]);

  const fetchStats = async () => {
    const [booksResult, membersResult, loansResult, overdueResult] = await Promise.all([
      supabase.from("books").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("borrow_records").select("id", { count: "exact", head: true }).eq("status", "issued"),
      supabase.from("borrow_records").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    ]);

    setStats({
      totalBooks: booksResult.count || 0,
      totalMembers: membersResult.count || 0,
      activeLoans: loansResult.count || 0,
      overdueBooks: overdueResult.count || 0,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Overview of library statistics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Books</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalBooks}</div>
              <p className="text-xs text-muted-foreground mt-1">In catalog</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalMembers}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
              <BookMarked className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.activeLoans}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently issued</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Overdue Books</CardTitle>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{stats.overdueBooks}</div>
              <p className="text-xs text-muted-foreground mt-1">Need attention</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common library management tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <button
                onClick={() => navigate("/books")}
                className="w-full text-left px-4 py-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <div className="font-medium">Manage Books</div>
                <div className="text-sm text-muted-foreground">Add, edit, or remove books from catalog</div>
              </button>
              <button
                onClick={() => navigate("/members")}
                className="w-full text-left px-4 py-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <div className="font-medium">Manage Members</div>
                <div className="text-sm text-muted-foreground">View and manage library members</div>
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest library transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Activity log coming soon...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}