import { Navigate, useParams } from "react-router-dom";

const ProductRedirect = () => {
  const { productId } = useParams();
  if (!productId) return <Navigate to="/" replace />;
  return <Navigate to={`/p/${encodeURIComponent(productId)}`} replace />;
};

export default ProductRedirect;
