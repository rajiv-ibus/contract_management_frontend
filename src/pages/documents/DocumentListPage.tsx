import { FileSearch, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { EmptyState, PageHeader, StatusBadge, fmtDate } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDemo, useLookups } from "@/demo/store";
import type { WorkflowStatus } from "@/demo/types";
import { cn } from "@/lib/utils";

const filters: { value: WorkflowStatus | "ALL"; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "DRAFT", label: "Draft" },
    { value: "APPROVAL_PENDING", label: "Approval pending" },
    { value: "REJECTED", label: "Rejected" },
    { value: "APPROVED", label: "Approved" },
    { value: "INVALID", label: "Invalid" },
];

export function DocumentListPage() {
    const { documents, projectId, permissions, documentTypes } = useDemo();
    const { userName, docType } = useLookups();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [query, setQuery] = useState("");
    const [typeId, setTypeId] = useState("");

    const status = (params.get("status") as WorkflowStatus | null) ?? "ALL";
    const projectDocs = documents.filter((d) => d.projectId === projectId);
    const projectTypes = documentTypes.filter((t) => t.projectId === projectId);

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return projectDocs
            .filter((d) => status === "ALL" || d.status === status)
            .filter((d) => !typeId || d.typeId === typeId)
            .filter(
                (d) =>
                    !q ||
                    d.title.toLowerCase().includes(q) ||
                    String(d.metadata.contractIdentifier ?? "").toLowerCase().includes(q) ||
                    String(d.metadata.counterpartyEntity ?? "").toLowerCase().includes(q),
            )
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }, [projectDocs, status, typeId, query]);

    return (
        <>
            <PageHeader
                title="Documents"
                description="All contracts in this project. Click a row to open it."
                actions={
                    permissions.canMake && (
                        <Button asChild>
                            <Link to="/documents/new">
                                <Plus /> New document
                            </Link>
                        </Button>
                    )
                }
            />

            <div className="mb-4 flex flex-wrap gap-1.5">
                {filters.map((f) => {
                    const count = f.value === "ALL" ? projectDocs.length : projectDocs.filter((d) => d.status === f.value).length;
                    return (
                        <button
                            key={f.value}
                            onClick={() => setParams(f.value === "ALL" ? {} : { status: f.value })}
                            className={cn(
                                "rounded-full border px-3 py-1 text-sm transition-colors",
                                status === f.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                            )}
                        >
                            {f.label} <span className="ml-1 opacity-70">{count}</span>
                        </button>
                    );
                })}
            </div>

            <Card>
                <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search by title, contract ID or counterparty"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="sm:w-60">
                        <NativeSelect value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                            <option value="">All document types</option>
                            {projectTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </div>
                </div>
                {rows.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Document</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Counterparty</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Version</TableHead>
                                <TableHead>Created by</TableHead>
                                <TableHead>Updated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((d) => (
                                <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate(`/documents/${d.id}`)}>
                                    <TableCell>
                                        <p className={cn("font-medium", d.status === "INVALID" && "text-muted-foreground")}>
                                            {d.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {String(d.metadata.contractIdentifier ?? "No contract ID yet")}
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{docType(d.typeId)?.name}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {String(d.metadata.counterpartyEntity ?? "—")}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={d.status} />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {d.currentVersionNo ? `v${d.currentVersionNo}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{userName(d.createdById)}</TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(d.updatedAt)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <EmptyState icon={FileSearch} title="No documents match" text="Try another status, type or search term." />
                )}
            </Card>
        </>
    );
}
