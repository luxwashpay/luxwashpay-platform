export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 amber-glow">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
