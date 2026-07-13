import TopNav from "@/components/ui/TopNav";
import BottomTabBar from "@/components/ui/BottomTabBar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopNav />
      <main className="md:pt-16 pb-20 md:pb-0">{children}</main>
      <BottomTabBar />
    </>
  );
}
