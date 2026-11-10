import {
    BarChart3,
    Building2,
    ChevronsUpDown,
    FileText,
    FolderCog,
    LayoutDashboard,
    LogOut,
    Menu,
    Settings2,
    UserPlus,
    Users,
    X,
    type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";

import { Initials } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { demoPersonas } from "@/demo/data";
import { useDemo } from "@/demo/store";
import type { DemoRole } from "@/demo/types";
import { cn } from "@/lib/utils";

interface NavItem {
    to: string;
    label: string;
    icon: LucideIcon;
    show: boolean;
}

function DemoBar() {
    const { role, setRole } = useDemo();
    const navigate = useNavigate();
    return (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-100 px-4 py-1.5 text-xs text-amber-900">
            <span className="font-semibold">UI prototype with sample data</span>
            <span className="hidden sm:inline">· View as:</span>
            <div className="flex flex-wrap gap-1">
                {(Object.keys(demoPersonas) as DemoRole[]).map((r) => (
                    <button
                        key={r}
                        onClick={() => {
                            setRole(r);
                            navigate("/dashboard");
                        }}
                        className={cn(
                            "rounded-full px-2.5 py-0.5 font-medium transition-colors",
                            r === role ? "bg-amber-900 text-amber-50" : "bg-amber-200/70 hover:bg-amber-200",
                        )}
                    >
                        {demoPersonas[r].label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function ProjectSwitcher() {
    const { myProjects, projectId, setProjectId, permissions } = useDemo();
    const navigate = useNavigate();
    const current = myProjects.find((p) => p.id === projectId);
    const roles = [permissions.isAdmin && "Admin", permissions.canMake && "Maker", permissions.canCheck && "Checker"]
        .filter(Boolean)
        .join(" · ");

    if (myProjects.length === 0) {
        return <p className="px-3 text-xs text-sidebar-muted">Not mapped to any project</p>;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-white/30">
                <Building2 className="size-4 shrink-0 text-sidebar-muted" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-sidebar-active">{current?.name}</p>
                    <p className="truncate text-[11px] text-sidebar-muted">{roles}</p>
                </div>
                <ChevronsUpDown className="size-4 shrink-0 text-sidebar-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel>Your projects</DropdownMenuLabel>
                {myProjects.map((p) => (
                    <DropdownMenuItem
                        key={p.id}
                        onSelect={() => {
                            setProjectId(p.id);
                            navigate("/dashboard");
                        }}
                    >
                        <Building2 />
                        <span className="flex-1">{p.name}</span>
                        {p.id === projectId && <span className="text-xs text-primary">Current</span>}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
    const { permissions, myProjects } = useDemo();
    const inProject = myProjects.length > 0;

    const workItems: NavItem[] = [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: inProject },
        { to: "/documents", label: "Documents", icon: FileText, show: inProject },
        { to: "/reports", label: "Reports", icon: BarChart3, show: inProject },
    ];
    const projectItems: NavItem[] = [
        { to: "/project/members", label: "Project members", icon: Users, show: permissions.isAdmin },
        { to: "/project/settings", label: "Project settings", icon: Settings2, show: permissions.isAdmin },
    ];
    const adminItems: NavItem[] = [
        { to: "/admin/team", label: "Team", icon: Users, show: permissions.isSuperAdmin },
        { to: "/admin/invite", label: "Invite user", icon: UserPlus, show: permissions.isSuperAdmin },
        { to: "/admin/projects", label: "Projects", icon: FolderCog, show: permissions.isSuperAdmin },
    ];

    const section = (title: string, items: NavItem[]) =>
        items.some((i) => i.show) && (
            <div className="flex flex-col gap-0.5">
                <p className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">
                    {title}
                </p>
                {items
                    .filter((i) => i.show)
                    .map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                                    isActive
                                        ? "bg-sidebar-accent font-medium text-sidebar-active"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                                )
                            }
                        >
                            <item.icon className="size-4" />
                            {item.label}
                        </NavLink>
                    ))}
            </div>
        );

    return (
        <div className="flex h-full flex-col gap-2 bg-sidebar p-3">
            <div className="flex items-center gap-2 px-2 py-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-white">
                    iB
                </div>
                <div className="leading-tight">
                    <p className="text-sm font-semibold text-sidebar-active">iBUS Contracts</p>
                    <p className="text-[11px] text-sidebar-muted">Contract Management</p>
                </div>
            </div>
            <ProjectSwitcher />
            <nav className="flex-1 overflow-y-auto">
                {section("Work", workItems)}
                {section("Project admin", projectItems)}
                {section("Administration", adminItems)}
            </nav>
        </div>
    );
}

function UserMenu() {
    const { currentUser, permissions } = useDemo();
    const navigate = useNavigate();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                <Initials name={currentUser.name} />
                <div className="hidden text-left leading-tight sm:block">
                    <p className="text-sm font-medium">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {permissions.isSuperAdmin ? "Super Admin" : currentUser.email}
                    </p>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>{currentUser.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/login")}>
                    <LogOut />
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function AppShell() {
    const [open, setOpen] = useState(false);
    return (
        <div className="flex min-h-screen flex-col">
            <DemoBar />
            <div className="flex flex-1">
                <aside className="hidden w-64 shrink-0 lg:block">
                    <div className="sticky top-0 h-screen">
                        <Sidebar />
                    </div>
                </aside>
                {open && (
                    <div className="fixed inset-0 z-40 lg:hidden">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
                        <div className="absolute inset-y-0 left-0 w-64">
                            <Sidebar onNavigate={() => setOpen(false)} />
                        </div>
                    </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur sm:px-6">
                        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setOpen(!open)}>
                            {open ? <X /> : <Menu />}
                        </Button>
                        <div className="flex-1" />
                        <UserMenu />
                    </header>
                    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
}
