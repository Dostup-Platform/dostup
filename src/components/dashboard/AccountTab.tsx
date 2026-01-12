import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { demoUser, demoPurchases, demoProduct } from "@/lib/demo-data";
import { User, Mail, Phone, Package, LogOut, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

const formatPrice = (price: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
  }).format(price / 100);
};

const AccountTab = () => {
  const navigate = useNavigate();
  const user = demoUser;
  const purchases = demoPurchases;

  const handleLogout = () => {
    navigate("/");
  };

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
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-foreground">{user.name}</p>
              <p className="text-sm text-muted-foreground">Member since {format(parseISO(user.created_at), "MMM yyyy")}</p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{user.email}</span>
            </div>
            {user.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{user.phone}</span>
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
          <div className="space-y-3">
            {purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="p-4 rounded-xl bg-muted/50 border border-border"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">{demoProduct.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Purchased {format(parseISO(purchase.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatPrice(purchase.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {purchases.length === 0 && (
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
