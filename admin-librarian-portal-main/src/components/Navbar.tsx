import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { BookOpen, LogOut, Users, BookMarked, LayoutDashboard, History, BookPlus, BookCheck, CreditCard, ListTodo } from "lucide-react";

export const Navbar = () => {
  const { user, userRole, signOut } = useAuth();

  return (
    <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-bold">
              localhost Library Management System
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                {(userRole === "admin" || userRole === "librarian") && (
                  <>
                    <Link to="/dashboard">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </Button>
                    </Link>
                    <Link to="/members">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Users className="h-4 w-4" />
                        Members
                      </Button>
                    </Link>
                    <Link to="/issue-book">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <BookPlus className="h-4 w-4" />
                        Issue
                      </Button>
                    </Link>
                    <Link to="/return-book">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <BookCheck className="h-4 w-4" />
                        Return
                      </Button>
                    </Link>
                    <Link to="/user-history">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <History className="h-4 w-4" />
                        History
                      </Button>
                    </Link>
                    <Link to="/requests">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <ListTodo className="h-4 w-4" />
                        Requests
                      </Button>
                    </Link>
                  </>
                )}
                {userRole === "admin" && (
                  <Link to="/membership-plans">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <CreditCard className="h-4 w-4" />
                      Plans
                    </Button>
                  </Link>
                )}
                <Link to="/books">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <BookMarked className="h-4 w-4" />
                    Books
                  </Button>
                </Link>
                <Link to="/my-books">
                  <Button variant="ghost" size="sm">
                    My Books
                  </Button>
                </Link>
                <Button onClick={signOut} variant="outline" size="sm" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button>Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};