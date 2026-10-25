import { ImageResponse } from "next/og";

export const alt = "Apuraí — acompanhe a apuração";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Cartão estático e sem números: não afirma nenhum resultado.
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#0a1530", color: "#fff" }}>
        <div style={{ fontSize: 96, fontWeight: 700, color: "#2ee59d" }}>Apuraí</div>
        <div style={{ fontSize: 44, marginTop: 20 }}>Apuração oficial com fonte e horário visíveis</div>
        <div style={{ fontSize: 32, marginTop: 16, color: "#cbd5e1" }}>Dados do Tribunal Superior Eleitoral (TSE)</div>
      </div>
    ),
    size,
  );
}
