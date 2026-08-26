import { useState, type ReactNode } from "react";
import { coverTintFromId } from "@/lib/productCover";
import { cn } from "@/lib/utils";

type ProductCoverProps = {
  productId: string;
  title?: string;
  imageUrl?: string | null;
  emoji?: string | null;
  className?: string;
  decorative?: boolean;
  children?: ReactNode;
};

const ProductCover = ({
  productId,
  title = "",
  imageUrl,
  emoji,
  className,
  decorative = true,
  children,
}: ProductCoverProps) => {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(imageUrl) && !broken;
  const tint = coverTintFromId(productId);

  return (
    <div
      className={cn(
        "relative aspect-[16/10] w-full overflow-hidden [container-type:size]",
        className,
      )}
    >
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
          className="relative h-full w-full"
          style={{ backgroundColor: tint }}
        >
          {emoji ? (
            <span
              className="pointer-events-none absolute left-1/2 select-none leading-none"
              style={{
                top: "33%",
                fontSize: "33cqh",
                opacity: 0.4,
                transform: "translate(-50%, -50%)",
              }}
              aria-hidden
            >
              {emoji}
            </span>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
};

export default ProductCover;
