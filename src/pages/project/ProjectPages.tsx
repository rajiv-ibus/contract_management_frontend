import { Braces, Lock, Mail, Plus, Trash2, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { EmptyState, Initials, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/Field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo, useLookups } from "@/demo/store";
import { LibraryManager } from "@/templates/LibraryManager";

function AdminOnly({ children }: { children: ReactNode }) {
    const { permissions } = useDemo();
    if (!permissions.isAdmin) {
        return (
            <EmptyState
                icon={Lock}
                title="Project Admins only"
                text="Switch the demo to Project Admin to see this screen."
            />
        );
    }
    return <>{children}</>;
}

export function ProjectMembersPage() {
    const { memberships, users, projectId, actions } = useDemo();
    const { projectName } = useLookups();
    const members = memberships.filter((m) => m.projectId === projectId);

    function change(userId: string, canMake: boolean, canCheck: boolean) {
        if (!canMake && !canCheck) {
            toast.error("Every member needs at least one role: Maker or Checker.");
            return;
        }
        actions.setMemberRoles(projectId, userId, canMake, canCheck);
        toast.success("Role updated.");
    }

    return (
        <AdminOnly>
            <PageHeader
                title="Project members"
                description={`Set who is a Maker or Checker in ${projectName(projectId)}. To add or remove people, ask a Super Admin.`}
            />
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Maker</TableHead>
                            <TableHead className="text-center">Checker</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {members.map((m) => {
                            const u = users.find((x) => x.id === m.userId)!;
                            return (
                                <TableRow key={m.userId}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Initials name={u.name} />
                                            <div>
                                                <p className="font-medium">
                                                    {u.name} {m.isAdmin && <Badge className="ml-1">Admin</Badge>}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{u.email}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {u.status === "ACTIVE" ? (
                                            <Badge variant="approved">Active</Badge>
                                        ) : u.status === "INVITED" ? (
                                            <Badge variant="pending">Invited</Badge>
                                        ) : (
                                            <Badge variant="muted">Deactivated</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Switch
                                            checked={m.canMake}
                                            onCheckedChange={(v) => change(m.userId, v, m.canCheck)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Switch
                                            checked={m.canCheck}
                                            disabled={m.isAdmin}
                                            title={m.isAdmin ? "Admins are always Checkers" : undefined}
                                            onCheckedChange={(v) => change(m.userId, m.canMake, v)}
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>
            <p className="mt-3 text-xs text-muted-foreground">
                Admins are always Checkers. Nobody can approve a document they created or submitted.
            </p>
        </AdminOnly>
    );
}

export function ProjectSettingsPage() {
    const { libraries, recipients, projectId, actions } = useDemo();
    const { projectName } = useLookups();
    const [newRecipient, setNewRecipient] = useState({ email: "", name: "" });

    const projectRecipients = recipients.filter((r) => r.projectId === projectId);

    return (
        <AdminOnly>
            <PageHeader
                title="Project settings"
                description={`Field library and email settings for ${projectName(projectId)}.`}
            />
            <Tabs defaultValue="library">
                <TabsList>
                    <TabsTrigger value="library">
                        <Braces /> Field library
                    </TabsTrigger>
                    <TabsTrigger value="emails">
                        <Mail /> Distribution list
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="library">
                    <LibraryManager
                        library={libraries[projectId]}
                        projectName={projectName(projectId)}
                        onSave={(next) => actions.saveLibrary(projectId, next)}
                    />
                </TabsContent>

                <TabsContent value="emails">
                    <div className="grid gap-6 lg:grid-cols-3">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Distribution list</CardTitle>
                                <CardDescription>
                                    These addresses are copied (CC) on every workflow email for this project: submitted,
                                    approved, rejected and invalidated.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-3">
                                {projectRecipients.length ? (
                                    <ul className="divide-y rounded-lg border">
                                        {projectRecipients.map((r) => (
                                            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                                                <Mail className="size-4 text-muted-foreground" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium">{r.email}</p>
                                                    {r.name && (
                                                        <p className="text-xs text-muted-foreground">{r.name}</p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label="Remove"
                                                    onClick={() => {
                                                        actions.removeRecipient(r.id);
                                                        toast.success("Removed from the distribution list.");
                                                    }}
                                                >
                                                    <Trash2 />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <EmptyState icon={Users} title="No addresses yet" />
                                )}
                            </CardContent>
                        </Card>
                        <Card className="h-fit">
                            <CardHeader>
                                <CardTitle className="text-sm">Add address</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <Field label="Email" required>
                                    <Input
                                        type="email"
                                        value={newRecipient.email}
                                        onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                                    />
                                </Field>
                                <Field label="Name (optional)">
                                    <Input
                                        value={newRecipient.name}
                                        onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
                                    />
                                </Field>
                                <Button
                                    disabled={!/^\S+@\S+\.\S+$/.test(newRecipient.email)}
                                    onClick={() => {
                                        actions.addRecipient(
                                            newRecipient.email.trim(),
                                            newRecipient.name.trim() || undefined,
                                        );
                                        setNewRecipient({ email: "", name: "" });
                                        toast.success("Added to the distribution list.");
                                    }}
                                >
                                    <Plus /> Add
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </AdminOnly>
    );
}
