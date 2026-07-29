import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";

// Fraunces (soft serif) for titles, Public Sans for interface text,
// IBM Plex Mono for anything that is a record: codes, counts, dates, roles.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono"
});

export const metadata = {
  title: "PetPrint",
  description: "Pet medical histories, vaccinations, and adoptions for clinics and rescues."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
