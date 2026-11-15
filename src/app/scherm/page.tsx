import type { Metadata } from "next";
import { TvScreen } from "./tv-screen";

export const metadata: Metadata = { title: "TV-scherm" };

export default function SchermPage() {
  return <TvScreen />;
}
