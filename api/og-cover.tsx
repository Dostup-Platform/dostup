import { ImageResponse } from "@vercel/og";
import { coverTintFromId } from "./_lib/og";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "default";
  const title = (searchParams.get("title") || "Dostup").slice(0, 120);
  const tint = coverTintFromId(id);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tint,
          padding: "48px",
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 600,
            color: "#1F2328",
            textAlign: "center",
            lineHeight: 1.25,
            maxWidth: "1000px",
          }}
        >
          {title}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
