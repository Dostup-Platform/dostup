import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { Loader2 } from "lucide-react";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "KZT", minimumFractionDigits: 0 }).format(price);

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { data: products = [], isLoading } = useProducts();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Доступ</h1>
          <Button onClick={() => navigate("/auth")}>Войти</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Доступ к обучению</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Выбирайте продукты и получайте доступ к материалам и занятиям.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">Продукты скоро появятся.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="block">
                <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden">
                  {p.image_url && (
                    <img src={p.image_url} alt={p.title} className="w-full h-40 object-cover" loading="lazy" />
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
                    {p.headline && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{p.headline}</p>}
                    <p className="text-primary font-bold">{formatPrice(Number(p.price))}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;