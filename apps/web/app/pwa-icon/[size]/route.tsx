import { ImageResponse } from "next/og";

const SIZES = ["180", "192", "512"] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size;
  if (!(SIZES as readonly string[]).includes(size)) return new Response(null, { status: 404 });
  const px = Number(size);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#14532d",
          color: "#ffffff",
          fontSize: px * 0.5,
          fontWeight: 700,
        }}
      >
        N
      </div>
    ),
    { width: px, height: px },
  );
}
