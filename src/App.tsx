import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import ProductPage from "./pages/ProductPage";
import CheckoutPage from "./pages/CheckoutPage";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Dashboard from "./pages/Dashboard";
import MaterialsPage from "./pages/MaterialsPage";
import CreatorMaterialsPage from "./pages/CreatorMaterialsPage";
import SchedulePage from "./pages/SchedulePage";
import CreatorSchedulePage from "./pages/CreatorSchedulePage";
import TeacherSchedulePage from "./pages/TeacherSchedulePage";
import SettingsPage from "./pages/SettingsPage";
import SupportPage from "./pages/SupportPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/product/:productId" element={<ProductPage />} />
            <Route path="/checkout/:productId" element={<CheckoutPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/materials/:productId" element={<MaterialsPage />} />
                <Route path="/creator/products/:productId/materials" element={<CreatorMaterialsPage />} />
                <Route path="/schedule/:productId" element={<SchedulePage />} />
                <Route path="/creator/products/:productId/schedule" element={<CreatorSchedulePage />} />
                <Route path="/teacher/products/:productId/schedule" element={<TeacherSchedulePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;