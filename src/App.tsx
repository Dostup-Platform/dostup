import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SimpleAuthProvider } from "@/contexts/SimpleAuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { InstallPromptProvider } from "@/contexts/InstallPromptContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import MarketplacePage from "./pages/MarketplacePage";
import LoginPage from "./pages/LoginPage";
import StorefrontPage from "./pages/StorefrontPage";
import ProductPage from "./pages/ProductPage";
import ProductRedirect from "./pages/ProductRedirect";
import ProductPurchasePage from "./pages/ProductPurchasePage";
import Dashboard from "./pages/Dashboard";
import CreatorDashboard from "./pages/CreatorDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import SchoolDashboard from "./pages/SchoolDashboard";
import ModeratorDashboard from "./pages/ModeratorDashboard";
import InstallPage from "./pages/InstallPage";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/NotFound";
import RequireProfile from "@/components/auth/RequireProfile";

const queryClient = new QueryClient();

function DevLocalhostRedirect() {
  if (!import.meta.env.DEV) return null;
  const { hostname, port, pathname, search } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  const targetPort = port || "8080";
  window.location.replace(`http://localhost:${targetPort}${pathname}${search}`);
  return null;
}

const App = () => (
  <ErrorBoundary>
    <DevLocalhostRedirect />
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
      <InstallPromptProvider>
      <SimpleAuthProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<MarketplacePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/s/:handle" element={<StorefrontPage />} />
                <Route path="/p/:productId" element={<ProductPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/product/:productId" element={<ProductRedirect />} />
                <Route path="/checkout/:productId" element={<ProductPurchasePage />} />
                <Route path="/dashboard" element={<RequireProfile><Dashboard /></RequireProfile>} />
                <Route path="/creator" element={<RequireProfile><CreatorDashboard /></RequireProfile>} />
                <Route path="/teacher" element={<TeacherDashboard />} />
                <Route path="/school" element={<RequireProfile><SchoolDashboard /></RequireProfile>} />
                <Route path="/moderator" element={<ModeratorDashboard />} />
                <Route path="/install" element={<InstallPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </SimpleAuthProvider>
      </InstallPromptProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
