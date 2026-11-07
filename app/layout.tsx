import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { InteractionSounds } from "@/components/site/InteractionSounds";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
});

export const metadata: Metadata = {
  title: "Beautiful UI — Crafted primitives for AI-native interfaces",
  description:
    "A small library of extremely crafted, copy-paste components for chat agents, thinking states, human-in-the-loop approvals, and everything agents need to talk to humans beautifully.",
};


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        <InteractionSounds />
        {children}
      </body>
    </html>
  );
}
