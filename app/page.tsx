import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { Homepage } from "@/components/homepage";
import "./homepage.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-home-body" });
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-home-heading",
});

export const metadata: Metadata = {
  title: "AI Repair Estimator — A clearer picture of repair costs",
  description:
    "Understand vehicle repair costs with AI-assisted estimates. Free signup, no subscription. NZ$9 + GST (NZ$10.35 total) per estimate.",
};

export default function Home() {
  return (
    <div className={`${dmSans.variable} ${manrope.variable}`}>
      <Homepage />
    </div>
  );
}
