"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  FileText,
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Menu,
  User,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/interviews", label: "Interviews", icon: MessageSquare },
];

const bottomNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const NavLink = ({
    href,
    label,
    icon: Icon,
    isCollapsed,
  }: {
    href: string;
    label: string;
    icon: React.ElementType;
    isCollapsed: boolean;
  }) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          isCollapsed && "justify-center px-2"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!isCollapsed && <span>{label}</span>}
      </Link>
    );
  };

  const SidebarContent = ({ isCollapsed }: { isCollapsed: boolean }) => (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between px-4 py-4">
        {!isCollapsed && (
          <h1 className="text-lg font-semibold">WhyJob</h1>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn("h-8 w-8", isCollapsed && "mx-auto")}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>

      <nav className="border-t border-sidebar-border px-2 py-4">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-full border-r border-sidebar-border bg-sidebar transition-all duration-200",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent isCollapsed={isCollapsed} />
      </aside>

      {/* Mobile Drawer Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open menu"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Drawer */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent isCollapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}