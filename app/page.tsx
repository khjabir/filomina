import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { HomeView } from "@/components/HomeView";
import { DriveGate } from "@/components/drive/DriveGate";

export default function HomePage() {
  return (
    <>
      <Header />
      <DriveGate>
        <HomeView />
      </DriveGate>
      <Footer />
    </>
  );
}
