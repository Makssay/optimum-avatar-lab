import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"] });
export const metadata: Metadata = { title: "Optimum Avatar Lab", description: "Create your avatar in the Optimum mascot style with AI." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ru"><body className={geist.variable}>{children}</body></html>; }
