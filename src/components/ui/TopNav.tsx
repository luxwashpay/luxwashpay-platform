"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "./Button";

const links = [
  { label: "Find Instructors", href: "/search" },
  { label: "For Schools", href: "/school/dashboard" },
  { label: "For Instructors", href: "/instructor/dashboard" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="hidden md:block fixed top-0 left-0 right-0 z-40 border-b border-border bg-white/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          <span className="text-xl font-heading font-bold text-text-primary">
            Drive<span className="text-accent">Now</span>
          </span>
        </Link>

        <nav className="flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname.startsWith(link.href)
                  ? "text-accent"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Sign Up</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
