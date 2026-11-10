import { Braces, FolderTree, Lock, Mail, Plus, Trash2, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { EmptyState, Initials, PageHeader, fmtDate } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Switch, Textarea } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo, useLookups } from "@/demo/store";
import type { DocumentType, FieldDef } from "@/demo/types";

function AdminOnly({ children }: { children: ReactNode }) {
    const { permissions } = useDemo();
    if (!permissions.isAdmin) {
        return <EmptyState icon={Lock} title="Project Admins only" text="Switch the demo to Project Admin to see this screen." />;
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
                                        <Switch checked={m.canMake} onCheckedChange={(v) => change(m.userId, v, m.canCheck)} />
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

const sampleTemplate = `{
  "fields": [
    { "key": "contractIdentifier", "label": "Contract ID", "type": "string", "required": true },
    { "key": "startDate", "label": "Start date", "type": "date", "required": true },
    { "key": "endDate", "label": "End date", "type": "date", "required": true },
    { "key": "pricingModel", "label": "Pricing model", "type": "enum", "required": true,
      "options": ["FIXED", "SHARED", "PERCENTAGE", "REVENUE_SHARE"] }
  ]
}`;

function parseTemplate(json: string): { fields?: FieldDef[]; error?: string } {
    try {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) return { error: "The JSON needs a non-empty \"fields\" list." };
        const types = ["string", "text", "date", "enum", "decimal", "tags"];
        for (const f of parsed.fields) {
            if (!f.key || !f.label) return { error: "Every field needs a \"key\" and a \"label\"." };
            if (!types.includes(f.type)) return { error: `Field "${f.key}": type must be one of ${types.join(", ")}.` };
            if (f.type === "enum" && !Array.isArray(f.options)) return { error: `Field "${f.key}": enum fields need "options".` };
        }
        return { fields: parsed.fields.map((f: FieldDef) => ({ ...f, required: !!f.required })) };
    } catch (e) {
        return { error: `Not valid JSON: ${(e as Error).message}` };
    }
}

function TemplateDialog({
    type,
    onClose,
}: {
    type: DocumentType | null;
    onClose: () => void;
}) {
    const { categories, projectId, actions } = useDemo();
    const current = type?.templates.find((t) => t.no === type.activeTemplateNo);
    const [json, setJson] = useState(current ? JSON.stringify({ fields: current.fields }, null, 2) : sampleTemplate);
    const [categoryId, setCategoryId] = useState("");
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const { fields, error } = parseTemplate(json);

    function save() {
        if (!fields) return;
        if (type) {
            actions.addTemplateVersion(type.id, fields);
            toast.success(`Template v${type.templates.length + 1} saved and active for new documents of ${type.name}.`);
        } else {
            if (!categoryId || !code.trim() || !name.trim()) {
                toast.error("Choose a category and enter a code and name.");
                return;
            }
            actions.addDocumentType(categoryId, code.trim().toUpperCase(), name.trim(), fields);
            toast.success(`Document type ${name} created.`);
        }
        onClose();
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{type ? `New template version · ${type.name}` : "New document type"}</DialogTitle>
                    <DialogDescription>
                        Paste or edit the field template as JSON. Saved templates are frozen; editing creates a new version.
                        Documents already submitted keep the template they were submitted with.
                    </DialogDescription>
                </DialogHeader>
                {!type && (
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Category" required>
                            <NativeSelect value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                                <option value="">Select…</option>
                                {categories
                                    .filter((c) => c.projectId === projectId)
                                    .map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                            </NativeSelect>
                        </Field>
                        <Field label="Code" required>
                            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="HOTEL_LEASE" />
                        </Field>
                        <Field label="Name" required>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hotel Lease" />
                        </Field>
                    </div>
                )}
                <Field label="Template JSON" hint="Tip: to reuse a type from another project, copy its JSON and paste it here.">
                    <Textarea value={json} onChange={(e) => setJson(e.target.value)} className="min-h-72 font-mono text-xs" spellCheck={false} />
                </Field>
                {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                ) : (
                    <p className="text-sm text-status-approved">✓ Valid template with {fields?.length} fields</p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={save} disabled={!!error}>
                        {type ? "Save as new version" : "Create document type"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ProjectSettingsPage() {
    const { categories, documentTypes, recipients, projectId, actions } = useDemo();
    const { projectName, userName } = useLookups();
    const [newCategory, setNewCategory] = useState({ code: "", name: "" });
    const [editingType, setEditingType] = useState<DocumentType | null | "new">(null);
    const [newRecipient, setNewRecipient] = useState({ email: "", name: "" });

    const projectCategories = categories.filter((c) => c.projectId === projectId);
    const projectTypes = documentTypes.filter((t) => t.projectId === projectId);
    const projectRecipients = recipients.filter((r) => r.projectId === projectId);

    return (
        <AdminOnly>
            <PageHeader title="Project settings" description={`Categories, document types, templates and email settings for ${projectName(projectId)}.`} />
            <Tabs defaultValue="types">
                <TabsList>
                    <TabsTrigger value="types">
                        <Braces /> Document types & templates
                    </TabsTrigger>
                    <TabsTrigger value="categories">
                        <FolderTree /> Categories
                    </TabsTrigger>
                    <TabsTrigger value="emails">
                        <Mail /> Distribution list
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="types">
                    <div className="mb-3 flex justify-end">
                        <Button onClick={() => setEditingType("new")}>
                            <Plus /> New document type
                        </Button>
                    </div>
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Document type</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Active template</TableHead>
                                    <TableHead>Fields</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projectTypes.map((t) => {
                                    const active = t.templates.find((x) => x.no === t.activeTemplateNo)!;
                                    return (
                                        <TableRow key={t.id}>
                                            <TableCell>
                                                <p className="font-medium">{t.name}</p>
                                                <p className="font-mono text-xs text-muted-foreground">{t.code}</p>
                                            </TableCell>
                                            <TableCell>{projectCategories.find((c) => c.id === t.categoryId)?.name}</TableCell>
                                            <TableCell>
                                                <p>v{t.activeTemplateNo}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {fmtDate(active.createdAt)} by {userName(active.createdBy)}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                {active.fields.length}{" "}
                                                <span className="text-xs text-muted-foreground">
                                                    ({active.fields.filter((f) => f.required).length} required)
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => setEditingType(t)}>
                                                    <Braces /> Edit template
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                <TabsContent value="categories">
                    <div className="grid gap-6 lg:grid-cols-3">
                        <Card className="lg:col-span-2">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Document types</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {projectCategories.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium">{c.name}</TableCell>
                                            <TableCell className="font-mono text-xs">{c.code}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {projectTypes
                                                    .filter((t) => t.categoryId === c.id)
                                                    .map((t) => t.name)
                                                    .join(", ") || "—"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                        <Card className="h-fit">
                            <CardHeader>
                                <CardTitle className="text-sm">Add category</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <Field label="Code">
                                    <Input value={newCategory.code} onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value })} />
                                </Field>
                                <Field label="Name">
                                    <Input value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} />
                                </Field>
                                <Button
                                    disabled={!newCategory.code.trim() || !newCategory.name.trim()}
                                    onClick={() => {
                                        actions.addCategory(newCategory.code.trim().toUpperCase(), newCategory.name.trim());
                                        setNewCategory({ code: "", name: "" });
                                        toast.success("Category added.");
                                    }}
                                >
                                    <Plus /> Add category
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="emails">
                    <div className="grid gap-6 lg:grid-cols-3">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Distribution list</CardTitle>
                                <CardDescription>
                                    These addresses are copied (CC) on every workflow email for this project: submitted, approved,
                                    rejected and invalidated.
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
                                                    {r.name && <p className="text-xs text-muted-foreground">{r.name}</p>}
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
                                    <Input type="email" value={newRecipient.email} onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })} />
                                </Field>
                                <Field label="Name (optional)">
                                    <Input value={newRecipient.name} onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })} />
                                </Field>
                                <Button
                                    disabled={!/^\S+@\S+\.\S+$/.test(newRecipient.email)}
                                    onClick={() => {
                                        actions.addRecipient(newRecipient.email.trim(), newRecipient.name.trim() || undefined);
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

            {editingType && <TemplateDialog type={editingType === "new" ? null : editingType} onClose={() => setEditingType(null)} />}
        </AdminOnly>
    );
}
