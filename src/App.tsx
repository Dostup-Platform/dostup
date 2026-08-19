import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SimpleAuthProvider } from "@/contexts/SimpleAuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import ProductPage from "./pages/ProductPage";
import ProductPurchasePage from "./pages/ProductPurchasePage";
import Dashboard from "./pages/Dashboard";
import CreatorDashboard from "./pages/CreatorDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import SchoolDashboard from "./pages/SchoolDashboard";
import ModeratorDashboard from "./pages/ModeratorDashboard";
import InstallPage from "./pages/InstallPage";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
      <SimpleAuthProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/product/:productId" element={<ProductPage />} />
                <Route path="/checkout/:productId" element={<ProductPurchasePage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/creator" element={<CreatorDashboard />} />
                <Route path="/teacher" element={<TeacherDashboard />} />
                <Route path="/school" element={<SchoolDashboard />} />
                <Route path="/moderator" element={<ModeratorDashboard />} />
                <Route path="/install" element={<InstallPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </SimpleAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
