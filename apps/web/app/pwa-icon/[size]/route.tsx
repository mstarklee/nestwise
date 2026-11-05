import { ImageResponse } from "next/og";

const SIZES = ["180", "192", "512"] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

// A gold temple-border band (zigzag teeth) over a pink line, under a white N, on peacock.
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size;
  if (!(SIZES as readonly string[]).includes(size)) return new Response(null, { status: 404 });
  const px = Number(size);
  const band = px * 0.18;
  const teeth = 6;
  const tooth = px / teeth;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#00566E" }}>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "#ffffff", fontSize: px * 0.46, fontWeight: 800 }}>
          N
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ display: "flex", width: "100%", height: band, background: "#F2B233" }}>
            {Array.from({ length: teeth }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: `${tooth / 2}px solid transparent`,
                  borderRight: `${tooth / 2}px solid transparent`,
                  borderTop: `${band * 0.6}px solid #00566E`,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", width: "100%", height: px * 0.04, background: "#D61F69" }} />
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
