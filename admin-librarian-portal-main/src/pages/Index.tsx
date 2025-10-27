import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, BookMarked, Shield } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/books");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="py-20 px-4" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto text-center">
          <div className="mb-6">
            <h1 className="text-6xl font-bold">
              Library Management System
            </h1>
          </div>
          <p className="text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Modern Library Management System
          </p>
          <p className="text-lg text-muted-foreground mb-10 max-w-3xl mx-auto">
            Streamline your library operations with our comprehensive platform. Manage books, track borrowing, handle member registrations, and more - all in one place.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/books")} className="text-lg px-8">
              Browse Books
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Key Features</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Everything you need to run a modern library efficiently
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="transition-all hover:shadow-lg">
              <CardHeader>
                <div className="p-3 rounded-lg bg-primary/10 w-fit mb-3">
                  <BookMarked className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Book Management</CardTitle>
                <CardDescription>
                  Easily catalog, search, and manage your entire book collection with detailed metadata and availability tracking.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all hover:shadow-lg">
              <CardHeader>
                <div className="p-3 rounded-lg bg-secondary/10 w-fit mb-3">
                  <Users className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle>Member Management</CardTitle>
                <CardDescription>
                  Register members, track memberships, and manage user profiles with ease. Complete member history at your fingertips.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all hover:shadow-lg">
              <CardHeader>
                <div className="p-3 rounded-lg bg-primary/10 w-fit mb-3">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Issue & Return</CardTitle>
                <CardDescription>
                  Streamlined borrowing workflow with automatic due date tracking, overdue notifications, and fine calculations.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all hover:shadow-lg">
              <CardHeader>
                <div className="p-3 rounded-lg bg-secondary/10 w-fit mb-3">
                  <Shield className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle>Role-Based Access</CardTitle>
                <CardDescription>
                  Secure system with distinct access levels for administrators, librarians, and members. Protect sensitive data.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all hover:shadow-lg">
              <CardHeader>
                <div className="p-3 rounded-lg bg-primary/10 w-fit mb-3">
                  <BookMarked className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Smart Search</CardTitle>
                <CardDescription>
                  Powerful search and filtering capabilities. Find books by title, author, category, ISBN, and availability status.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="transition-all hover:shadow-lg">
              <CardHeader>
                <div className="p-3 rounded-lg bg-secondary/10 w-fit mb-3">
                  <Users className="h-6 w-6 text-secondary" />
                </div>
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>
                  Get insights into library operations with comprehensive statistics on books, members, loans, and overdue items.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-card">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join us today and transform your library management experience
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
            Create Account
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
