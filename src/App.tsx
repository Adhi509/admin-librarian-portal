import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Books from "./pages/Books";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import MyBooks from "./pages/MyBooks";
import UserHistory from "./pages/UserHistory";
import IssueBook from "./pages/IssueBook";
import ReturnBook from "./pages/ReturnBook";
import MembershipPlans from "./pages/MembershipPlans";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/books" element={<Books />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/my-books" element={<MyBooks />} />
            <Route path="/user-history" element={<UserHistory />} />
            <Route path="/issue-book" element={<IssueBook />} />
            <Route path="/return-book" element={<ReturnBook />} />
            <Route path="/membership-plans" element={<MembershipPlans />} />
            <Route path="/notifications" element={<Notifications />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
