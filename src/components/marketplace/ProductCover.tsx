import { useState, type ReactNode } from "react";
import { coverTintFromId } from "@/lib/productCover";
import { cn } from "@/lib/utils";

type ProductCoverProps = {
  productId: string;
  title: string;
  imageUrl?: string | null;
  className?: string;
  titleClassName?: string;
  decorative?: boolean;
  children?: ReactNode;
};

const ProductCover = ({
  productId,
  title,
  imageUrl,
  className,
  titleClassName,
  decorative = true,
  children,
}: ProductCoverProps) => {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(imageUrl) && !broken;
  const tint = coverTintFromId(productId);

  return (
    <div className={cn("relative aspect-[16/10] w-full overflow-hidden", className)}>
      {showImage ? (
        <img
          src={imageUrl!}
          alt={decorative ? "" : title}
          className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.02]"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          aria-hidden={decorative || undefined}
          className="flex h-full w-full items-center justify-center p-5"
          style={{ backgroundColor: tint }}
        >
          <p
            className={cn(
              "line-clamp-3 text-center text-[20px] font-semibold leading-snug text-[#1F2328]",
              titleClassName,
            )}
          >
            {title}
          </p>
        </div>
      )}
      {children}
    </div>
  );
};

export default ProductCover;
