"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  FolderKanban,
  ListTodo,
  Clock,
  Bell,
  Settings,
  LogOut,
  ChevronUp,
  Bot,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const mainNavItems = [
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
];

const systemNavItems = [
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
];

interface AppSidebarProps {
  user: {
    email: string;
    name?: string;
  };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : user.email.substring(0, 2).toUpperCase();

  return (
    <Sidebar className="border-r border-white/5 bg-sidebar/50 backdrop-blur-xl">
      <SidebarHeader className="pt-4 pb-2">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary/10 border border-primary/20 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight">MAIA</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Executive Assistant</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="bg-white/5 my-2" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/50 uppercase tracking-widest text-[10px] font-bold">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium hover:bg-white/5 transition-all duration-200"
                  >
                    <Link href={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/50 uppercase tracking-widest text-[10px] font-bold mt-4">Automation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium hover:bg-white/5 transition-all duration-200"
                  >
                    <Link href={item.url} className="flex items-center gap-3">
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
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-white/10">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold rounded-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                    <span className="truncate font-semibold text-foreground">
                      {user.name || "User"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl border-white/10 bg-card/95 backdrop-blur-xl p-1"
                side="top"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuItem asChild className="rounded-lg focus:bg-primary/10 focus:text-primary cursor-pointer">
                  <Link href="/settings">
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
