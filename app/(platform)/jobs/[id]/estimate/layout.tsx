import type { ReactNode } from "react";
import { syncAutomaticParkingFee } from "@/lib/estimating/parking-fees";

export default async function EstimateLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await syncAutomaticParkingFee(id);
  return children;
}
