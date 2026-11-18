
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FINANCE AI — Finanzas personales inteligentes",
  description:
    "Organizá tus finanzas, entendé tus hábitos y planificá mejor con FINANCE AI."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
