import { Building2, Lock, MailPlus, Pencil, Plus, Search, UserCheck, UserX } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { EmptyState, Initials, PageHeader, fmtAgo } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDemo } from "@/demo/store";
import type { Membership, User } from "@/demo/types";

function SuperAdminOnly({ children }: { children: ReactNode }) {
    const { permissions } = useDemo();
    if (!permissions.isSuperAdmin) {
        return (
            <EmptyState
                icon={Lock}
                title="Super Admin only"
                text="Switch the demo to Super Admin to see this screen."
            />
        );
    }
    return <>{children}</>;
}

const userStatusBadge = (s: User["status"]) =>
    s === "ACTIVE" ? (
        <Badge variant="approved">Active</Badge>
    ) : s === "INVITED" ? (
        <Badge variant="pending">Invited</Badge>
    ) : (
        <Badge variant="muted">Deactivated</Badge>
    );

function AccessEditor({ user, onClose }: { user: User; onClose: () => void }) {
    const { projects, memberships, actions } = useDemo();
    const [rows, setRows] = useState<Record<string, Membership | undefined>>(() =>
        Object.fromEntries(
            projects.map((p) => [p.id, memberships.find((m) => m.userId === user.id && m.projectId === p.id)]),
        ),
    );

    function toggle(projectId: string, key: "access" | "isAdmin" | "canMake" | "canCheck", value: boolean) {
        setRows((all) => {
            const current = all[projectId];
            if (key === "access") {
                return {
                    ...all,
                    [projectId]: value
                        ? { userId: user.id, projectId, isAdmin: false, canMake: true, canCheck: false }
                        : undefined,
                };
            }
            if (!current) return all;
            const next = { ...current, [key]: value };
            if (key === "isAdmin" && value) next.canCheck = true;
            if (!next.canMake && !next.canCheck) return all;
            return { ...all, [projectId]: next };
        });
    }

    function save() {
        actions.setUserMemberships(
            user.id,
            Object.values(rows).filter((m): m is Membership => !!m),
        );
        toast.success(`Project access updated for ${user.name}.`);
        onClose();
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Project access · {user.name}</DialogTitle>
                    <DialogDescription>
                        Choose which projects {user.name.split(" ")[0]} can open and the role in each. A project Admin
                        is always a Checker. Every member needs at least Maker or Checker.
                    </DialogDescription>
                </DialogHeader>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead className="text-center">Access</TableHead>
                            <TableHead className="text-center">Admin</TableHead>
                            <TableHead className="text-center">Maker</TableHead>
                            <TableHead className="text-center">Checker</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projects.map((p) => {
                            const m = rows[p.id];
                            return (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <p className="font-medium">{p.name}</p>
                                        <p className="text-xs text-muted-foreground">{p.code}</p>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={!!m}
                                            onCheckedChange={(v) => toggle(p.id, "access", v === true)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            disabled={!m}
                                            checked={!!m?.isAdmin}
                                            onCheckedChange={(v) => toggle(p.id, "isAdmin", v === true)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            disabled={!m}
                                            checked={!!m?.canMake}
                                            onCheckedChange={(v) => toggle(p.id, "canMake", v === true)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            disabled={!m || m.isAdmin}
                                            checked={!!m?.canCheck}
                                            onCheckedChange={(v) => toggle(p.id, "canCheck", v === true)}
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={save}>Save access</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function TeamPage() {
    const { users, memberships, projects, actions } = useDemo();
    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState<User | null>(null);

    const rows = users.filter(
        (u) =>
            !query ||
            u.name.toLowerCase().includes(query.toLowerCase()) ||
            u.email.toLowerCase().includes(query.toLowerCase()),
    );

    const access = (u: User) =>
        memberships
            .filter((m) => m.userId === u.id)
            .map((m) => {
                const p = projects.find((x) => x.id === m.projectId);
                const roles = [m.isAdmin && "Admin", m.canMake && "Maker", m.canCheck && !m.isAdmin && "Checker"]
                    .filter(Boolean)
                    .join(" + ");
                return `${p?.name}: ${roles}`;
            });

    return (
        <SuperAdminOnly>
            <PageHeader
                title="Team"
                description="Everyone with an account. Give project access and choose project Admins here."
                actions={
                    <Button asChild>
                        <Link to="/admin/invite">
                            <MailPlus /> Invite user
                        </Link>
                    </Button>
                }
            />
            <Card>
                <div className="border-b p-3">
                    <div className="relative max-w-sm">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search name or email"
                            className="pl-9"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Project access</TableHead>
                            <TableHead>Last sign-in</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Initials name={u.name} />
                                        <div>
                                            <p className="font-medium">
                                                {u.name} {u.isSuperAdmin && <Badge className="ml-1">Super Admin</Badge>}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{u.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>{userStatusBadge(u.status)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5 text-xs">
                                        {access(u).length ? (
                                            access(u).map((a) => <span key={a}>{a}</span>)
                                        ) : (
                                            <span className="text-muted-foreground">No projects</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {u.lastLoginAt ? fmtAgo(u.lastLoginAt) : "Never"}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1.5">
                                        <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                                            <Pencil /> Access
                                        </Button>
                                        {u.status === "INVITED" && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    toast.success(
                                                        `New invite link sent to ${u.email}. The old link no longer works.`,
                                                    )
                                                }
                                            >
                                                Resend invite
                                            </Button>
                                        )}
                                        {u.status === "ACTIVE" && !u.isSuperAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    actions.setUserStatus(u.id, "DEACTIVATED");
                                                    toast.success(`${u.name} deactivated and signed out everywhere.`);
                                                }}
                                            >
                                                <UserX /> Deactivate
                                            </Button>
                                        )}
                                        {u.status === "DEACTIVATED" && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    actions.setUserStatus(u.id, "ACTIVE");
                                                    toast.success(`${u.name} reactivated.`);
                                                }}
                                            >
                                                <UserCheck /> Reactivate
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
            <p className="mt-3 text-xs text-muted-foreground">
                Super Admins are added only by a database change, so there is no option for it here.
            </p>
            {editing && <AccessEditor user={editing} onClose={() => setEditing(null)} />}
        </SuperAdminOnly>
    );
}

export function InvitePage() {
    const { users, actions } = useDemo();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    function invite() {
        if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
            setError("Enter a name and a valid email address.");
            return;
        }
        if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
            setError("Someone with this email already has an account.");
            return;
        }
        actions.inviteUser(name.trim(), email.trim());
        toast.success(`Invitation sent to ${email}. You can give project access now from the Team screen.`);
        navigate("/admin/team");
    }

    return (
        <SuperAdminOnly>
            <PageHeader title="Invite a user" description="They'll get an email with a link to set their password." />
            <Card className="max-w-xl">
                <CardContent className="flex flex-col gap-4">
                    <Field label="Full name" required htmlFor="name">
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>
                    <Field
                        label="Email"
                        required
                        htmlFor="email"
                        hint="The invite link is valid for 48 hours and works once."
                    >
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </CardContent>
                <CardFooter className="justify-end">
                    <Button variant="outline" asChild>
                        <Link to="/admin/team">Cancel</Link>
                    </Button>
                    <Button onClick={invite}>
                        <MailPlus /> Send invitation
                    </Button>
                </CardFooter>
            </Card>
        </SuperAdminOnly>
    );
}

export function ProjectsPage() {
    const { projects, memberships, documents, actions } = useDemo();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ code: "", name: "", description: "" });

    function create() {
        if (!form.code.trim() || !form.name.trim()) return;
        actions.addProject(form.code.trim().toUpperCase(), form.name.trim(), form.description.trim());
        toast.success(`Project ${form.name} created. Give people access from the Team screen.`);
        setOpen(false);
        setForm({ code: "", name: "", description: "" });
    }

    return (
        <SuperAdminOnly>
            <PageHeader
                title="Projects"
                description="Each document belongs to one project. Only members of a project can see its documents."
                actions={
                    <Button onClick={() => setOpen(true)}>
                        <Plus /> New project
                    </Button>
                }
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => {
                    const members = memberships.filter((m) => m.projectId === p.id);
                    return (
                        <Card key={p.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="size-4 text-muted-foreground" />
                                        <CardTitle>{p.name}</CardTitle>
                                    </div>
                                    {p.active ? (
                                        <Badge variant="approved">Active</Badge>
                                    ) : (
                                        <Badge variant="muted">Inactive</Badge>
                                    )}
                                </div>
                                <CardDescription>{p.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <p className="text-lg font-semibold">{p.code}</p>
                                    <p className="text-xs text-muted-foreground">Code</p>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold">{members.length}</p>
                                    <p className="text-xs text-muted-foreground">Members</p>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold">
                                        {documents.filter((d) => d.projectId === p.id).length}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Documents</p>
                                </div>
                            </CardContent>
                            <CardFooter className="justify-between text-xs text-muted-foreground">
                                <span>Admins: {members.filter((m) => m.isAdmin).length || "none yet"}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        actions.updateProject(p.id, { active: !p.active });
                                        toast.success(`${p.name} ${p.active ? "deactivated" : "activated"}.`);
                                    }}
                                >
                                    {p.active ? "Deactivate" : "Activate"}
                                </Button>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New project</DialogTitle>
                        <DialogDescription>
                            After creating it, give users access and choose its Admins on the Team screen.
                        </DialogDescription>
                    </DialogHeader>
                    <Field label="Code" required hint="Short, unique, e.g. HOSP">
                        <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                    </Field>
                    <Field label="Name" required>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </Field>
                    <Field label="Description">
                        <Textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                    </Field>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={create} disabled={!form.code.trim() || !form.name.trim()}>
                            Create project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SuperAdminOnly>
    );
}
