import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, Users, ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4">
            <Package className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Digital Products</h1>
          <p className="text-muted-foreground">Sell courses, materials, and sessions</p>
        </div>

        <div className="space-y-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <Link to="/product/demo" className="flex items-center justify-between p-5">
                <div>
                  <h3 className="font-semibold text-foreground">View Demo Product</h3>
                  <p className="text-sm text-muted-foreground">See the product page experience</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <Link to="/dashboard" className="flex items-center justify-between p-5">
                <div>
                  <h3 className="font-semibold text-foreground">User Dashboard</h3>
                  <p className="text-sm text-muted-foreground">Access materials & schedule</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-primary/20">
            <CardContent className="p-0">
              <Link to="/creator" className="flex items-center justify-between p-5">
                <div>
                  <h3 className="font-semibold text-foreground">Creator Dashboard</h3>
                  <p className="text-sm text-muted-foreground">Manage products & users</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          This is a demo. Connect Lovable Cloud for full functionality.
        </p>
      </div>
    </div>
  );
};

export default Index;
