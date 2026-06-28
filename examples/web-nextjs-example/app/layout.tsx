import type { ReactNode } from "react";
// oxlint-disable-next-line import/no-unassigned-import -- Next.js applies global CSS via import.
import "./styles.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
