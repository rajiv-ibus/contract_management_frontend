import { ArrowRight, ClipboardCheck, FilePen, History, Plus } from "lucide-react";
import { Link } from "react-router";

import { EmptyState, PageHeader, StatusBadge, fmtAgo, statusMeta } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { counterpartyName } from "@/demo/docs";
import { useDemo, useLookups } from "@/demo/store";
import type { ContractDocument, WorkflowStatus } from "@/demo/types";
import { cn } from "@/lib/utils";

const statusOrder: WorkflowStatus[] = ["DRAFT", "APPROVAL_PENDING", "REJECTED", "APPROVED", "INVALID"];

function DocRow({ doc }: { doc: ContractDocument }) {
    const { userName, docType } = useLookups();
    const type = docType(doc.projectId, doc.typeCode);
    return (
        <Link
            to={`/documents/${doc.id}`}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60"
        >
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {type?.name} · {counterpartyName(doc.values, type)} · by {userName(doc.createdById)} ·{" "}
                    {fmtAgo(doc.updatedAt)}
                </p>
            </div>
            <StatusBadge status={doc.status} />
        </Link>
    );
}

export function DashboardPage() {
    const { documents, projectId, currentUser, permissions, myProjects } = useDemo();
    const { userName, projectName } = useLookups();

    if (myProjects.length === 0) {
        return (
            <EmptyState
                icon={ClipboardCheck}
                title="You are not mapped to any project yet"
                text="Ask a Super Admin to give you project access."
            />
        );
    }

    const projectDocs = documents.filter((d) => d.projectId === projectId);
    const counts = Object.fromEntries(statusOrder.map((s) => [s, projectDocs.filter((d) => d.status === s).length]));

    const awaitingMe = projectDocs.filter((d) => {
        if (d.status !== "APPROVAL_PENDING") return false;
        const submitter = d.versions.find((v) => v.no === d.currentVersionNo)?.submittedBy;
        return d.createdById !== currentUser.id && submitter !== currentUser.id;
    });
    const myWork = projectDocs.filter(
        (d) =>
            (d.status === "DRAFT" || d.status === "REJECTED") &&
            (d.createdById === currentUser.id || permissions.canMake),
    );
    const recent = projectDocs
        .flatMap((d) => d.activity.map((a) => ({ ...a, doc: d })))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 7);

    return (
        <>
            <PageHeader
                title={`Good day, ${currentUser.name.split(" ")[0]}`}
                description={`${projectName(projectId)} project · here is what needs your attention`}
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

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {statusOrder.map((s) => {
                    const meta = statusMeta[s];
                    const Icon = meta.icon;
                    return (
                        <Link key={s} to={`/documents?status=${s}`}>
                            <Card className="h-full transition-shadow hover:shadow-md">
                                <CardContent className="flex flex-col gap-2 p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">{meta.label}</span>
                                        <Icon
                                            className={cn("size-4", {
                                                "text-status-draft": s === "DRAFT",
                                                "text-status-pending": s === "APPROVAL_PENDING",
                                                "text-status-rejected": s === "REJECTED",
                                                "text-status-approved": s === "APPROVED",
                                                "text-status-invalid": s === "INVALID",
                                            })}
                                        />
                                    </div>
                                    <span className="text-2xl font-semibold">{counts[s]}</span>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {permissions.canCheck && (
                    <Card>
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardCheck className="size-4 text-status-pending" />
                                Waiting for your approval
                            </CardTitle>
                            <Link
                                to="/documents?status=APPROVAL_PENDING"
                                className="text-sm text-primary hover:underline"
                            >
                                View all
                            </Link>
                        </CardHeader>
                        <CardContent className="px-2 pt-2">
                            {awaitingMe.length ? (
                                awaitingMe.map((d) => <DocRow key={d.id} doc={d} />)
                            ) : (
                                <EmptyState
                                    icon={ClipboardCheck}
                                    title="Nothing to review"
                                    text="Documents submitted by others will appear here."
                                />
                            )}
                        </CardContent>
                    </Card>
                )}

                {permissions.canMake && (
                    <Card>
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <FilePen className="size-4 text-primary" />
                                Drafts and rejected documents
                            </CardTitle>
                            <Link to="/documents?status=DRAFT" className="text-sm text-primary hover:underline">
                                View all
                            </Link>
                        </CardHeader>
                        <CardContent className="px-2 pt-2">
                            {myWork.length ? (
                                myWork.map((d) => <DocRow key={d.id} doc={d} />)
                            ) : (
                                <EmptyState
                                    icon={FilePen}
                                    title="No drafts"
                                    text="Start a new document to see it here."
                                />
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="size-4 text-muted-foreground" />
                            Recent activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <ul className="flex flex-col divide-y">
                            {recent.map((a, i) => (
                                <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
                                    <span className="w-28 shrink-0 text-xs text-muted-foreground">{fmtAgo(a.at)}</span>
                                    <span className="min-w-0 flex-1 truncate">
                                        <span className="font-medium">{userName(a.byId)}</span> {a.action.toLowerCase()}{" "}
                                        ·{" "}
                                        <Link to={`/documents/${a.doc.id}`} className="text-primary hover:underline">
                                            {a.doc.title}
                                        </Link>
                                    </span>
                                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
