import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useUserPurchases } from "@/hooks/usePurchases";
import { useAuth } from "@/contexts/AuthContext";
import { User, Mail, Phone, Package, LogOut, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(price);
};

const AccountTab = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: purchases, isLoading: purchasesLoading } = useUserPurchases();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {(profile?.name || user?.email || "U").charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-foreground">{profile?.name || "User"}</p>
              <p className="text-sm text-muted-foreground">
                Member since {profile?.created_at ? format(parseISO(profile.created_at), "MMM yyyy") : "Recently"}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{profile?.email || user?.email}</span>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{profile.phone}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Purchased Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            My Purchases
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchasesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : purchases && purchases.length > 0 ? (
            <div className="space-y-3">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="p-4 rounded-xl bg-muted/50 border border-border"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">
                        {purchase.products?.title || "Product"}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Purchased {format(parseISO(purchase.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {formatPrice(Number(purchase.amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No purchases yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
};

export default AccountTab;
