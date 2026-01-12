import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { demoProduct, demoMaterials } from "@/lib/demo-data";
import { Plus, Edit, Trash2, Copy, ExternalLink, FileText, Video, Type, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const formatPrice = (price: number, currency: string = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
  }).format(price / 100);
};

const CreatorProductsTab = () => {
  const [products, setProducts] = useState([demoProduct]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const copyLink = (productId: string) => {
    const link = `${window.location.origin}/product/${productId}`;
    navigator.clipboard.writeText(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Your Products</h2>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Product</DialogTitle>
            </DialogHeader>
            <form className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="Product title" className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headline">Headline</Label>
                <Input id="headline" placeholder="What the user gets" className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Detailed description" rows={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (in cents)</Label>
                <Input id="price" type="number" placeholder="9900" className="h-12" />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label htmlFor="schedule">Enable Scheduling</Label>
                  <p className="text-sm text-muted-foreground">Allow users to book sessions</p>
                </div>
                <Switch id="schedule" />
              </div>
              <Button type="submit" variant="cta" className="w-full">
                Create Product
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products List */}
      <div className="space-y-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{product.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{product.headline}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(product.price, product.currency)}
                    </span>
                    {product.has_schedule && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Scheduling enabled
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyLink(product.id)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={`/product/${product.id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>

              {/* Materials Preview */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-foreground">Materials</h4>
                  <Button variant="ghost" size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {demoMaterials.slice(0, 3).map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-sm"
                    >
                      {material.type === "video" && <Video className="w-4 h-4 text-muted-foreground" />}
                      {material.type === "file" && <FileText className="w-4 h-4 text-muted-foreground" />}
                      {material.type === "text" && <Type className="w-4 h-4 text-muted-foreground" />}
                      <span className="flex-1 truncate">{material.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">No products yet</p>
          <Button variant="default" className="mt-4" onClick={() => setIsCreating(true)}>
            Create Your First Product
          </Button>
        </div>
      )}
    </div>
  );
};

export default CreatorProductsTab;
