import {
    ArrowLeft,
    Ban,
    CheckCircle2,
    CopyPlus,
    Download,
    FileText,
    History,
    Info,
    MessageSquare,
    Pencil,
    RotateCcw,
    Send,
    ShieldCheck,
    Trash2,
    Undo2,
    XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { EmptyState, Initials, PageHeader, StatusBadge, fmtAgo, fmtDateTime } from "@/components/common";
import { MetadataView, displayValue, fieldErrors, isVisible } from "@/components/metadata";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, NativeSelect, Textarea } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo, useLookups } from "@/demo/store";
import type { Comment, ContractDocument, FieldDef, Version } from "@/demo/types";
import { cn } from "@/lib/utils";

type DialogKind = "approve" | "reject" | "invalidate" | "delete" | "submit" | null;

function versionState(doc: ContractDocument, v: Version) {
    if (doc.approvedVersionNo === v.no) return doc.status === "INVALID" ? "Approved, now invalid" : "Approved";
    if (doc.comments.some((c) => c.versionNo === v.no && c.type === "REJECTION")) return "Rejected";
    if (doc.currentVersionNo === v.no && doc.status === "APPROVAL_PENDING") return "Waiting for review";
    return "Superseded";
}

function SummarySheetPreview({ doc, fields, version }: { doc: ContractDocument; fields: FieldDef[]; version: Version }) {
    const { docType, userName } = useLookups();
    const { documents } = useDemo();
    const sourceDoc = documents.find((d) => d.id === doc.createdFromId);
    const source = sourceDoc ? `Created from ${String(sourceDoc.metadata.contractIdentifier)} (invalid)` : null;
    return (
        <div className="mx-auto w-full max-w-md rounded-sm border bg-white p-6 text-[11px] leading-relaxed text-slate-700 shadow-md">
            <p className="text-center text-xs font-bold tracking-widest text-slate-900 uppercase">Summary Reference Sheet</p>
            <p className="mb-3 text-center text-[10px] text-slate-500">
                Final section of the combined PDF · version {version.no}
            </p>
            <table className="w-full">
                <tbody>
                    <tr>
                        <td className="w-2/5 py-0.5 pr-2 font-semibold text-slate-900">Document</td>
                        <td>{doc.title}</td>
                    </tr>
                    <tr>
                        <td className="py-0.5 pr-2 font-semibold text-slate-900">Type</td>
                        <td>{docType(doc.typeId)?.name}</td>
                    </tr>
                    {fields
                        .filter((f) => isVisible(f, version.metadata))
                        .map((f) => (
                            <tr key={f.key}>
                                <td className="py-0.5 pr-2 align-top font-semibold text-slate-900">{f.label}</td>
                                <td>{displayValue(f, version.metadata[f.key])}</td>
                            </tr>
                        ))}
                    {source && (
                        <tr>
                            <td className="py-0.5 pr-2 font-semibold text-slate-900">Reference</td>
                            <td>{source}</td>
                        </tr>
                    )}
                    <tr>
                        <td className="py-0.5 pr-2 font-semibold text-slate-900">Submitted by</td>
                        <td>
                            {userName(version.submittedBy)}, {fmtDateTime(version.submittedAt)}
                        </td>
                    </tr>
                </tbody>
            </table>
            <div className="mt-3 border-t pt-2">
                <p className="font-semibold text-slate-900">Version content hash (SHA-256)</p>
                <p className="font-mono text-[9px] break-all text-slate-500">{version.fileHash}</p>
            </div>
        </div>
    );
}

function NotesTab({ doc, canComment }: { doc: ContractDocument; canComment: boolean }) {
    const { actions } = useDemo();
    const { userName } = useLookups();
    const [text, setText] = useState("");
    const [versionNo, setVersionNo] = useState(doc.currentVersionNo ?? 0);
    const [replyTo, setReplyTo] = useState<Comment | null>(null);

    if (!doc.versions.length) {
        return (
            <EmptyState
                icon={MessageSquare}
                title="No comments yet"
                text="Comments start once the document is submitted. Each comment belongs to the version it discusses."
            />
        );
    }

    const versions = [...doc.versions].sort((a, b) => b.no - a.no);

    function post() {
        if (!text.trim()) return;
        actions.addComment(doc.id, replyTo?.versionNo ?? versionNo, text.trim(), replyTo?.id);
        setText("");
        setReplyTo(null);
        toast.success("Comment added.");
    }

    return (
        <div className="flex flex-col gap-6">
            {versions.map((v) => {
                const comments = doc.comments.filter((c) => c.versionNo === v.no && !c.replyToId);
                const state = versionState(doc, v);
                return (
                    <section key={v.no}>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold">Version {v.no}</h3>
                            <Badge
                                variant={
                                    state.startsWith("Approved") ? "approved" : state === "Rejected" ? "rejected" : state === "Waiting for review" ? "pending" : "muted"
                                }
                            >
                                {state}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                submitted by {userName(v.submittedBy)} · {fmtDateTime(v.submittedAt)}
                            </span>
                        </div>
                        {comments.length === 0 ? (
                            <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                                No comments on this version.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {comments.map((c) => {
                                    const replies = doc.comments.filter((r) => r.replyToId === c.id);
                                    return (
                                        <li key={c.id} className="rounded-lg border bg-card">
                                            <CommentItem comment={c} onReply={canComment ? () => setReplyTo(c) : undefined} />
                                            {replies.length > 0 && (
                                                <ul className="ml-10 flex flex-col border-t">
                                                    {replies.map((r) => (
                                                        <li key={r.id}>
                                                            <CommentItem comment={r} />
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                );
            })}

            {canComment && (
                <Card>
                    <CardContent className="flex flex-col gap-3 p-4">
                        {replyTo ? (
                            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
                                <span>
                                    Replying to {userName(replyTo.authorId)} on version {replyTo.versionNo}
                                </span>
                                <button className="text-primary hover:underline" onClick={() => setReplyTo(null)}>
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <Field label="Comment on" className="sm:w-56">
                                <NativeSelect value={versionNo} onChange={(e) => setVersionNo(Number(e.target.value))}>
                                    {versions.map((v) => (
                                        <option key={v.no} value={v.no}>
                                            Version {v.no}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </Field>
                        )}
                        <Textarea placeholder="Write a comment…" value={text} onChange={(e) => setText(e.target.value)} />
                        <div className="flex justify-between gap-2">
                            <p className="text-xs text-muted-foreground">Comments can't be edited or deleted once posted.</p>
                            <Button size="sm" onClick={post} disabled={!text.trim()}>
                                Post comment
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function CommentItem({ comment, onReply }: { comment: Comment; onReply?: () => void }) {
    const { userName } = useLookups();
    const name = userName(comment.authorId);
    return (
        <div className="flex gap-3 p-4">
            <Initials name={name} />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{name}</span>
                    {comment.type === "APPROVAL" && (
                        <Badge variant="approved">
                            <CheckCircle2 /> Approval
                        </Badge>
                    )}
                    {comment.type === "REJECTION" && (
                        <Badge variant="rejected">
                            <XCircle /> Rejection
                        </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{fmtAgo(comment.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm whitespace-pre-line">{comment.text}</p>
                {onReply && (
                    <button onClick={onReply} className="mt-1.5 text-xs font-medium text-primary hover:underline">
                        Reply
                    </button>
                )}
            </div>
        </div>
    );
}

export function DocumentDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { documents, currentUser, permissions, actions } = useDemo();
    const { userName, docType, categoryName } = useLookups();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [text, setText] = useState("");
    const [compare, setCompare] = useState(false);

    const doc = documents.find((d) => d.id === id);
    if (!doc) {
        return <EmptyState icon={FileText} title="Document not found" text="It may have been deleted, or you don't have access." />;
    }

    const type = docType(doc.typeId);
    const fields = type?.templates.find((t) => t.no === type.activeTemplateNo)?.fields ?? [];
    const current = doc.versions.find((v) => v.no === doc.currentVersionNo);
    const previous = doc.versions.find((v) => v.no === (doc.currentVersionNo ?? 0) - 1);
    const shownMetadata = doc.status === "DRAFT" || !current ? doc.metadata : current.metadata;
    const sourceDoc = doc.createdFromId ? documents.find((d) => d.id === doc.createdFromId) : undefined;
    const rejection = [...doc.comments].reverse().find((c) => c.type === "REJECTION" && c.versionNo === doc.currentVersionNo);

    const isOwn = doc.createdById === currentUser.id || current?.submittedBy === currentUser.id;
    const can = {
        edit: permissions.canMake && doc.status === "DRAFT",
        submit: permissions.canMake && doc.status === "DRAFT",
        deleteDraft: permissions.canMake && doc.status === "DRAFT" && doc.versions.length === 0,
        reopen: permissions.canMake && doc.status === "REJECTED",
        review: permissions.canCheck && doc.status === "APPROVAL_PENDING" && !isOwn,
        invalidate: permissions.canCheck && doc.status === "APPROVED" && !isOwn,
        createNew: permissions.canMake && doc.status === "INVALID",
    };
    const ownReviewBlocked = permissions.canCheck && doc.status === "APPROVAL_PENDING" && isOwn;

    function close() {
        setDialog(null);
        setText("");
    }

    function confirm() {
        if (!doc) return;
        switch (dialog) {
            case "approve":
                actions.approve(doc.id, text);
                toast.success(`Version ${doc.currentVersionNo} approved. The Maker has been emailed.`);
                break;
            case "reject":
                actions.reject(doc.id, text);
                toast.success(`Version ${doc.currentVersionNo} rejected. The Maker has been emailed.`);
                break;
            case "invalidate":
                actions.invalidate(doc.id, text);
                toast.success("Document marked invalid.");
                break;
            case "submit":
                actions.submit(doc.id);
                toast.success("Submitted for approval.");
                break;
            case "delete":
                actions.deleteDraft(doc.id);
                toast.success("Draft deleted.");
                navigate("/documents");
                break;
        }
        close();
    }

    function trySubmit() {
        if (!doc) return;
        const errors = fieldErrors(fields, doc.metadata);
        if (Object.keys(errors).length || !doc.draftFileName) {
            toast.error("Some required details or the PDF are missing. Edit the draft first.");
            return;
        }
        setDialog("submit");
    }

    const dialogs: Record<Exclude<DialogKind, null>, { title: string; text: string; field?: string; required?: boolean; button: string; variant: "default" | "destructive" | "success" }> = {
        approve: {
            title: `Approve version ${doc.currentVersionNo}`,
            text: "Once approved, the document is locked and can't be edited or reopened. The Maker and the distribution list are emailed.",
            field: "Comment (optional)",
            button: "Approve",
            variant: "success",
        },
        reject: {
            title: `Reject version ${doc.currentVersionNo}`,
            text: "The document goes back to the Maker for correction. Your comment is saved on this version and shown on the Notes screen.",
            field: "What needs to change?",
            required: true,
            button: "Reject",
            variant: "destructive",
        },
        invalidate: {
            title: "Mark this document invalid",
            text: "The document stays in the system, clearly marked as not usable. This can't be undone. A Maker can create a new document from it.",
            field: "Reason",
            required: true,
            button: "Mark invalid",
            variant: "destructive",
        },
        submit: {
            title: "Submit for approval",
            text: `This freezes the current details and PDF as version ${doc.versions.length + 1} and emails the project's Checkers.`,
            button: "Submit",
            variant: "default",
        },
        delete: {
            title: "Delete this draft",
            text: "This draft was never submitted, so it can be deleted. It will no longer appear in any list.",
            button: "Delete draft",
            variant: "destructive",
        },
    };
    const active = dialog ? dialogs[dialog] : null;

    return (
        <>
            <Link to="/documents" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" /> Documents
            </Link>

            <PageHeader
                title={
                    <span className="flex flex-wrap items-center gap-3">
                        <span className={cn(doc.status === "INVALID" && "text-muted-foreground")}>{doc.title}</span>
                        <StatusBadge status={doc.status} />
                    </span>
                }
                description={`${String(doc.metadata.contractIdentifier ?? "No contract ID")} · ${categoryName(type?.categoryId ?? "")} › ${type?.name} · created by ${userName(doc.createdById)}`}
                actions={
                    <>
                        {current && (
                            <Button variant="outline" onClick={() => toast("In the real app this downloads the combined PDF.")}>
                                <Download /> PDF
                            </Button>
                        )}
                        {can.deleteDraft && (
                            <Button variant="destructive-outline" onClick={() => setDialog("delete")}>
                                <Trash2 /> Delete draft
                            </Button>
                        )}
                        {can.edit && (
                            <Button variant="outline" asChild>
                                <Link to={`/documents/${doc.id}/edit`}>
                                    <Pencil /> Edit
                                </Link>
                            </Button>
                        )}
                        {can.submit && (
                            <Button onClick={trySubmit}>
                                <Send /> Submit for approval
                            </Button>
                        )}
                        {can.reopen && (
                            <Button
                                onClick={() => {
                                    actions.reopen(doc.id);
                                    toast.success("Reopened as a draft. Make your corrections and submit again.");
                                }}
                            >
                                <Undo2 /> Reopen for correction
                            </Button>
                        )}
                        {can.review && (
                            <>
                                <Button variant="destructive-outline" onClick={() => setDialog("reject")}>
                                    <XCircle /> Reject
                                </Button>
                                <Button variant="success" onClick={() => setDialog("approve")}>
                                    <CheckCircle2 /> Approve
                                </Button>
                            </>
                        )}
                        {can.invalidate && (
                            <Button variant="destructive-outline" onClick={() => setDialog("invalidate")}>
                                <Ban /> Mark invalid
                            </Button>
                        )}
                        {can.createNew && (
                            <Button
                                onClick={() => {
                                    const newId = actions.createFromInvalid(doc.id);
                                    toast.success("New draft created with the same PDF and details.");
                                    navigate(`/documents/${newId}/edit`);
                                }}
                            >
                                <CopyPlus /> Create new from this
                            </Button>
                        )}
                    </>
                }
            />

            <div className="mb-6 flex flex-col gap-3">
                {doc.status === "INVALID" && (
                    <div className="flex items-start gap-3 rounded-lg border border-status-invalid/30 bg-muted p-4">
                        <Ban className="mt-0.5 size-5 text-status-invalid" />
                        <div className="text-sm">
                            <p className="font-medium">This document is invalid and must not be used.</p>
                            <p className="mt-0.5 text-muted-foreground">
                                {doc.invalidationReason} — marked by {userName(doc.invalidatedById)},{" "}
                                {fmtDateTime(doc.invalidatedAt)}
                            </p>
                        </div>
                    </div>
                )}
                {doc.status === "REJECTED" && rejection && (
                    <div className="flex items-start gap-3 rounded-lg border border-status-rejected/30 bg-status-rejected/5 p-4">
                        <XCircle className="mt-0.5 size-5 text-status-rejected" />
                        <div className="text-sm">
                            <p className="font-medium">
                                Version {rejection.versionNo} was rejected by {userName(rejection.authorId)}
                            </p>
                            <p className="mt-0.5">“{rejection.text}”</p>
                        </div>
                    </div>
                )}
                {doc.status === "APPROVED" && (
                    <div className="flex items-center gap-3 rounded-lg border border-status-approved/30 bg-status-approved/5 p-4 text-sm">
                        <ShieldCheck className="size-5 text-status-approved" />
                        Version {doc.approvedVersionNo} is approved and locked. It can't be edited or reopened.
                    </div>
                )}
                {ownReviewBlocked && (
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/60 p-4 text-sm">
                        <Info className="size-5 text-muted-foreground" />
                        You created or submitted this document, so another Checker must review it.
                    </div>
                )}
                {sourceDoc && (
                    <div className="flex items-center gap-3 rounded-lg border bg-primary/5 p-4 text-sm">
                        <Info className="size-5 text-primary" />
                        <span>
                            Created from invalid document{" "}
                            <Link to={`/documents/${sourceDoc.id}`} className="font-medium text-primary hover:underline">
                                {String(sourceDoc.metadata.contractIdentifier)} · {sourceDoc.title}
                            </Link>
                        </span>
                    </div>
                )}
            </div>

            <Tabs defaultValue="details">
                <TabsList>
                    <TabsTrigger value="details">
                        <FileText /> Details
                    </TabsTrigger>
                    <TabsTrigger value="notes">
                        <MessageSquare /> Notes
                        {doc.comments.length > 0 && <Badge variant="muted">{doc.comments.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="versions">
                        <History /> Versions
                        {doc.versions.length > 0 && <Badge variant="muted">{doc.versions.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="activity">
                        <RotateCcw /> Activity
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                    <div className="grid gap-6 lg:grid-cols-5">
                        <Card className="lg:col-span-3">
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>
                                    {doc.status === "DRAFT" || !current ? "Working details (draft)" : `Details · version ${current.no}`}
                                </CardTitle>
                                {previous && doc.status !== "DRAFT" && (
                                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                                        Highlight changes from v{previous.no}
                                    </label>
                                )}
                            </CardHeader>
                            <CardContent>
                                <MetadataView
                                    fields={fields}
                                    values={shownMetadata}
                                    compareTo={compare && previous ? previous.metadata : undefined}
                                />
                            </CardContent>
                        </Card>
                        <div className="flex flex-col gap-4 lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">File</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-3">
                                    {(current?.fileName ?? doc.draftFileName) ? (
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-md bg-red-50 p-2">
                                                <FileText className="size-5 text-red-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">
                                                    {doc.status === "DRAFT" ? doc.draftFileName : current?.fileName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {doc.status === "DRAFT" ? "Uploaded contract (draft)" : "Combined PDF: contract + Summary Reference Sheet"}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No PDF uploaded yet.</p>
                                    )}
                                </CardContent>
                            </Card>
                            {current && doc.status !== "DRAFT" && (
                                <div>
                                    <p className="mb-2 text-xs font-medium text-muted-foreground">Preview of the last page</p>
                                    <SummarySheetPreview doc={doc} fields={fields} version={current} />
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="notes">
                    <NotesTab doc={doc} canComment={permissions.canMake || permissions.canCheck} />
                </TabsContent>

                <TabsContent value="versions">
                    {doc.versions.length ? (
                        <Card>
                            <ul className="divide-y">
                                {[...doc.versions]
                                    .sort((a, b) => b.no - a.no)
                                    .map((v) => {
                                        const state = versionState(doc, v);
                                        return (
                                            <li key={v.no} className="flex flex-wrap items-center gap-3 p-4">
                                                <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                                                    v{v.no}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium">
                                                        {v.fileName}{" "}
                                                        <Badge
                                                            className="ml-1"
                                                            variant={state.startsWith("Approved") ? "approved" : state === "Rejected" ? "rejected" : state === "Waiting for review" ? "pending" : "muted"}
                                                        >
                                                            {state}
                                                        </Badge>
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {v.restoredFrom && `Restored from v${v.restoredFrom} · `}
                                                        Submitted by {userName(v.submittedBy)} · {fmtDateTime(v.submittedAt)} · file hash{" "}
                                                        <span className="font-mono">{v.fileHash.slice(0, 12)}…</span>
                                                    </p>
                                                </div>
                                                <Button variant="outline" size="sm" onClick={() => toast("In the real app this downloads that version's PDF.")}>
                                                    <Download /> PDF
                                                </Button>
                                                {permissions.canMake && doc.status === "DRAFT" && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            actions.restoreVersion(doc.id, v.no);
                                                            toast.success(`Version ${v.no} copied into the draft.`);
                                                        }}
                                                    >
                                                        <RotateCcw /> Restore to draft
                                                    </Button>
                                                )}
                                            </li>
                                        );
                                    })}
                            </ul>
                        </Card>
                    ) : (
                        <EmptyState icon={History} title="No versions yet" text="A version is created every time the document is submitted." />
                    )}
                </TabsContent>

                <TabsContent value="activity">
                    <Card>
                        <CardContent>
                            <ol className="relative flex flex-col gap-5 border-l pl-6">
                                {[...doc.activity].reverse().map((a, i) => (
                                    <li key={i} className="relative">
                                        <span className="absolute top-1 -left-[29px] size-2.5 rounded-full border-2 border-card bg-primary" />
                                        <p className="text-sm">
                                            <span className="font-medium">{userName(a.byId)}</span> · {a.action}
                                        </p>
                                        {a.detail && <p className="text-sm text-muted-foreground">{a.detail}</p>}
                                        <p className="text-xs text-muted-foreground">{fmtDateTime(a.at)}</p>
                                    </li>
                                ))}
                            </ol>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={!!dialog} onOpenChange={(o) => !o && close()}>
                {active && (
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{active.title}</DialogTitle>
                            <DialogDescription>{active.text}</DialogDescription>
                        </DialogHeader>
                        {active.field && (
                            <Field label={active.field} required={active.required}>
                                <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} />
                            </Field>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={close}>
                                Cancel
                            </Button>
                            <Button variant={active.variant} onClick={confirm} disabled={!!active.required && !text.trim()}>
                                {active.button}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </>
    );
}
