import type { Metadata } from "next";
import HeraHarness from "@/components/hera/HeraHarness";

export const metadata: Metadata = {
  title: "Hera — your home insurance agent",
  description: "Hera reads your policy, keeps your home file, and handles insurance for you.",
};

export default function Home() {
  return <HeraHarness />;
}
