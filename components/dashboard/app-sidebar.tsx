"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  FolderKanban,
  ListTodo,
  Clock,
  Bell,
  BellRing,
  Settings,
  LogOut,
  ChevronUp,
  MessageSquarePlus,
  Lightbulb,
  Bug,
  Activity,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";


const navItems = [
  {
    title: "Chat",
    url: "/",
    icon: MessageSquare,
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderKanban,
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: ListTodo,
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: BellRing,
  },
  {
    title: "Schedules",
    url: "/schedules",
    icon: Clock,
  },
  {
    title: "Reminders",
    url: "/reminders",
    icon: Bell,
  },
  {
    title: "Activity",
    url: "/activity",
    icon: Activity,
  },
];

const feedbackItems = [
  {
    title: "Submit Feedback",
    url: "/feedback",
    icon: MessageSquarePlus,
  },
  {
    title: "Feature Requests",
    url: "/feedback/features",
    icon: Lightbulb,
  },
  {
    title: "Bug Reports",
    url: "/feedback/bugs",
    icon: Bug,
  },
];


interface AppSidebarProps {
  user: {
    email: string;
    name?: string;
  };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();

  // Close mobile menu when navigating
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Auto-collapse sidebar on chat pages (main chat and feedback chat), expand on others
  useEffect(() => {
    if (pathname === "/" || pathname === "/feedback") {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [pathname]); // Only run on path change, not on state change

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : user.email.substring(0, 2).toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar/50 backdrop-blur-xl">
      <SidebarHeader className="h-14 flex items-center justify-center border-b border-sidebar-border p-0">
        <div className="flex w-full items-center gap-3 px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          {/* Icon logo - shown when collapsed */}
          <div className="flex h-6 w-6 items-center justify-center shrink-0 group-data-[collapsible=icon]:block hidden">
            <Image
              src="/logos/profile-icon-512.png"
              alt="MAIA"
              width={24}
              height={24}
              className="h-6 w-6"
            />
          </div>
          {/* Full logo - shown when expanded */}
          <div className="flex items-center overflow-hidden group-data-[collapsible=icon]:hidden">
            <Image
              src="/logos/blue-white-logo.svg"
              alt="MAIA"
              width={180}
              height={20}
              className="h-5 w-auto"
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium hover:bg-white/5 transition-all duration-200"
                  >
                    <Link href={item.url} onClick={handleNavClick} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Feedback Section */}
        <SidebarGroup className="mt-4">
          <div className="px-3 py-2 group-data-[collapsible=icon]:hidden">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Feedback</span>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {feedbackItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium hover:bg-white/5 transition-all duration-200"
                  >
                    <Link href={item.url} onClick={handleNavClick} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={user.name || user.email}
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-white/10">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold rounded-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-1 group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold text-foreground">
                      {user.name || "User"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl border-white/10 bg-card/95 backdrop-blur-xl p-1"
                side="top"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuItem asChild className="rounded-lg focus:bg-primary/10 focus:text-primary cursor-pointer">
                  <Link href="/settings" onClick={handleNavClick}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem asChild className="rounded-lg focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                  <form action="/auth/signout" method="post" className="w-full">
                    <button
                      type="submit"
                      className="flex w-full items-center"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
