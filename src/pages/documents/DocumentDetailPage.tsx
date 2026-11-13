import {
    AlertTriangle,
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
    ScrollText,
    Send,
    ShieldCheck,
    Trash2,
    Undo2,
    XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { EmptyState, Initials, PageHeader, StatusBadge, fmtAgo, fmtDateTime } from "@/components/common";
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
import { Field } from "@/components/Field";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { approvalFields, deriveContext, documentIssues, submitLibrary } from "@/demo/docs";
import { useDemo, useLookups } from "@/demo/store";
import type { Comment, ContractDocument, Version } from "@/demo/types";
import { cn } from "@/lib/utils";
import { countByTier } from "@/templates/engine";
import { SummarySheet } from "@/templates/SummarySheet";
import { TemplateView } from "@/templates/TemplateView";

type DialogKind = "approve" | "reject" | "invalidate" | "delete" | "submit" | null;

function versionState(doc: ContractDocument, v: Version) {
    if (doc.approvedVersionNo === v.no) return doc.status === "INVALID" ? "Approved, now invalid" : "Approved";
    if (doc.comments.some((c) => c.versionNo === v.no && c.type === "REJECTION")) return "Rejected";
    if (doc.currentVersionNo === v.no && doc.status === "APPROVAL_PENDING") return "Waiting for review";
    return "Superseded";
}

const stateVariant = (state: string) =>
    state.startsWith("Approved")
        ? "approved"
        : state === "Rejected"
          ? "rejected"
          : state === "Waiting for review"
            ? "pending"
            : "muted";

function NotesTab({ doc, canComment }: { doc: ContractDocument; canComment: boolean }) {
    const { actions } = useDemo();
    const { userName } = useLookups();
    const [text, setText] = useState("");
    // Comments are only ever added to the current version. Earlier versions keep their comments as read-only history.
    const versionNo = doc.currentVersionNo ?? 0;
    const [replyTo, setReplyTo] = useState<Comment | null>(null);

    if (!doc.versions.length) {
        return (
            <EmptyState
                icon={MessageSquare}
                title="No comments yet"
                text="Comments start once the document is submitted. They are added to the current version."
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
            {versions
                .filter((v) => v.no === versionNo)
                .map((v) => {
                    const comments = doc.comments.filter((c) => c.versionNo === v.no && !c.replyToId);
                    const state = versionState(doc, v);
                    return (
                        <section key={v.no}>
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold">Version {v.no}</h3>
                                <Badge variant="pending">Current</Badge>
                                <Badge variant={stateVariant(state)}>{state}</Badge>
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
                                                <CommentItem
                                                    comment={c}
                                                    onReply={canComment ? () => setReplyTo(c) : undefined}
                                                />
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

            {versions.some((v) => v.no !== versionNo) && (
                <details className="rounded-lg border bg-card">
                    <summary className="cursor-pointer px-4 py-3 text-sm text-muted-foreground">
                        Earlier versions · comments kept as history, read only
                    </summary>
                    <div className="flex flex-col gap-4 border-t p-4">
                        {versions
                            .filter((v) => v.no !== versionNo)
                            .map((v) => {
                                const earlier = doc.comments.filter((c) => c.versionNo === v.no);
                                return (
                                    <section key={v.no}>
                                        <h3 className="mb-2 text-sm font-semibold">Version {v.no}</h3>
                                        {earlier.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                No comments on this version.
                                            </p>
                                        ) : (
                                            <ul className="flex flex-col divide-y rounded-lg border">
                                                {earlier.map((c) => (
                                                    <li key={c.id}>
                                                        <CommentItem comment={c} />
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </section>
                                );
                            })}
                    </div>
                </details>
            )}

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
                            <p className="text-sm text-muted-foreground">
                                Your comment will be added to{" "}
                                <span className="font-medium text-foreground">Version {versionNo} (current)</span>. To
                                mention an earlier version, write it in the comment.
                            </p>
                        )}
                        <Textarea
                            placeholder="Write a comment…"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                        />
                        <div className="flex justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                                Comments can't be edited or deleted once posted.
                            </p>
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
    const { documents, libraries, currentUser, permissions, actions } = useDemo();
    const { userName, docType, familyName, projectName } = useLookups();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [text, setText] = useState("");
    const [attested, setAttested] = useState<string[]>([]);
    const [compare, setCompare] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);

    const doc = documents.find((d) => d.id === id);
    const library = doc ? libraries[doc.projectId] : undefined;

    const current = doc?.versions.find((v) => v.no === doc.currentVersionNo);
    const previous = doc?.versions.find((v) => v.no === (doc.currentVersionNo ?? 0) - 1);
    const shownValues = doc && (doc.status === "DRAFT" || !current ? doc.values : current.values);

    const issues = useMemo(
        () => (doc && library && shownValues ? documentIssues(library, doc.typeCode, shownValues) : []),
        [doc, library, shownValues],
    );

    // Fields the Checker answers at approval (the attestation) only appear once a version has been approved, and
    // show what the Checker recorded. Before that they are not part of what is being reviewed.
    const approved = !!doc?.approvedVersionNo;
    const viewLibrary = useMemo(
        () => (library ? (approved ? library : submitLibrary(library)) : undefined),
        [library, approved],
    );
    const viewValues = useMemo(() => {
        if (!doc || !library || !shownValues || !approved || !doc.attestation) return shownValues;
        const answered = Object.fromEntries(
            approvalFields(library, doc.typeCode, shownValues).map((f) => [
                f.key,
                doc.attestation!.items.includes(f.label),
            ]),
        );
        return { ...shownValues, fields: { ...shownValues.fields, ...answered } };
    }, [doc, library, shownValues, approved]);

    if (!doc || !library || !shownValues || !viewLibrary || !viewValues) {
        return (
            <EmptyState
                icon={FileText}
                title="Document not found"
                text="It may have been deleted, or you don't have access."
            />
        );
    }

    const type = docType(doc.projectId, doc.typeCode);
    const sourceDoc = doc.createdFromId ? documents.find((d) => d.id === doc.createdFromId) : undefined;
    const rejection = [...doc.comments]
        .reverse()
        .find((c) => c.type === "REJECTION" && c.versionNo === doc.currentVersionNo);
    const attestFields = approvalFields(library, doc.typeCode, shownValues);
    const tiers = countByTier(issues);

    const derive = deriveContext(doc, {
        preparedBy: userName(current?.submittedBy ?? doc.createdById),
        verifiedBy: userName(doc.attestation?.byId),
        fileRef: current ? `${current.fileName} · ${current.fileHash.slice(0, 12)}…` : undefined,
    });

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
        setAttested([]);
    }

    function confirm() {
        if (!doc) return;
        switch (dialog) {
            case "approve":
                actions.approve(doc.id, text, attested);
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
        const blocking = documentIssues(library!, doc.typeCode, doc.values).filter((i) => i.tier === "BLOCK").length;
        if (blocking || !doc.draftFileName) {
            toast.error("Some required details or the PDF are missing. Edit the draft first.");
            return;
        }
        setDialog("submit");
    }

    const allAttested = attestFields.every((f) => attested.includes(f.label));
    const dialogs: Record<
        Exclude<DialogKind, null>,
        {
            title: string;
            text: string;
            field?: string;
            required?: boolean;
            button: string;
            variant: "default" | "destructive" | "success";
            disabled?: boolean;
        }
    > = {
        approve: {
            title: `Approve version ${doc.currentVersionNo}`,
            text: "Once approved, the document is locked and can't be edited or reopened. The Maker and the distribution list are emailed.",
            field: "Comment (optional)",
            button: "Approve",
            variant: "success",
            disabled: !allAttested,
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
            text:
                `This freezes the current details and PDF as version ${doc.versions.length + 1} and emails the project's Checkers.` +
                (tiers.WARN ? ` The Checker will see ${tiers.WARN} warning${tiers.WARN === 1 ? "" : "s"}.` : ""),
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
            <Link
                to="/documents"
                className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-4" /> Documents
            </Link>

            <PageHeader
                title={
                    <span className="flex flex-wrap items-center gap-3">
                        <span className={cn(doc.status === "INVALID" && "text-muted-foreground")}>{doc.title}</span>
                        <StatusBadge status={doc.status} />
                    </span>
                }
                description={`Project ${projectName(doc.projectId)} · ${doc.instanceId ?? "Instance ID assigned on first submission"} · ${familyName(doc.projectId, doc.typeCode)} › ${type?.name} · created by ${userName(doc.createdById)}`}
                actions={
                    <>
                        {current && (
                            <Button
                                variant="outline"
                                onClick={() => toast("In the real app this downloads the combined PDF.")}
                            >
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
                        <span>
                            Version {doc.approvedVersionNo} is approved and locked. It can't be edited or reopened.
                            {doc.attestation &&
                                ` Attested by ${userName(doc.attestation.byId)}, ${fmtDateTime(doc.attestation.at)}.`}
                        </span>
                    </div>
                )}
                {doc.status === "APPROVAL_PENDING" && can.review && (tiers.WARN > 0 || tiers.FLAG > 0) && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <AlertTriangle className="mt-0.5 size-5 text-amber-600" />
                        <div className="min-w-0">
                            <p className="font-medium">
                                {tiers.WARN} warning{tiers.WARN === 1 ? "" : "s"} for you
                                {tiers.FLAG > 0 &&
                                    ` and ${tiers.FLAG} note${tiers.FLAG === 1 ? "" : "s"} for the signer`}
                            </p>
                            <ul className="mt-1 list-disc pl-5">
                                {issues
                                    .filter((i) => i.tier !== "BLOCK")
                                    .map((i, n) => (
                                        <li key={n}>{i.message}</li>
                                    ))}
                            </ul>
                        </div>
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
                            <Link
                                to={`/documents/${sourceDoc.id}`}
                                className="font-medium text-primary hover:underline"
                            >
                                {sourceDoc.instanceId} · {sourceDoc.title}
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
                    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
                        <div className="min-w-0">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <h2 className="text-sm font-semibold">
                                    {doc.status === "DRAFT" || !current
                                        ? "Working details (draft)"
                                        : `Details · version ${current.no}`}
                                </h2>
                                {previous && doc.status !== "DRAFT" && (
                                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            checked={compare}
                                            onChange={(e) => setCompare(e.target.checked)}
                                        />
                                        Highlight changes from v{previous.no}
                                    </label>
                                )}
                            </div>
                            <TemplateView
                                library={viewLibrary}
                                typeCode={doc.typeCode}
                                values={viewValues}
                                derive={derive}
                                issues={issues.filter((i) => i.tier !== "BLOCK")}
                                compareTo={compare && previous ? previous.values : undefined}
                            />
                        </div>
                        <div className="flex flex-col gap-4">
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
                                                    {doc.status === "DRAFT"
                                                        ? "Uploaded contract (draft)"
                                                        : "Combined PDF: contract + Summary Reference Sheet"}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No PDF uploaded yet.</p>
                                    )}
                                </CardContent>
                            </Card>
                            {current && doc.status !== "DRAFT" && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm">Summary Reference Sheet</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-3 pt-3 text-sm text-muted-foreground">
                                        <p>The last section of the combined PDF. It lists every value above as text.</p>
                                        <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
                                            <ScrollText /> Preview the sheet
                                        </Button>
                                    </CardContent>
                                </Card>
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
                                                        <Badge className="ml-1" variant={stateVariant(state)}>
                                                            {state}
                                                        </Badge>
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {v.restoredFrom && `Restored from v${v.restoredFrom} · `}
                                                        Submitted by {userName(v.submittedBy)} ·{" "}
                                                        {fmtDateTime(v.submittedAt)} · file hash{" "}
                                                        <span className="font-mono">{v.fileHash.slice(0, 12)}…</span>
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        toast("In the real app this downloads that version's PDF.")
                                                    }
                                                >
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
                        <EmptyState
                            icon={History}
                            title="No versions yet"
                            text="A version is created every time the document is submitted."
                        />
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
                        {dialog === "approve" && attestFields.length > 0 && (
                            <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Attestation (required before approval)
                                </p>
                                {attestFields.map((f) => (
                                    <label key={f.key} className="flex items-start gap-2.5 text-sm">
                                        <Checkbox
                                            checked={attested.includes(f.label)}
                                            onCheckedChange={(on) =>
                                                setAttested((all) =>
                                                    on === true ? [...all, f.label] : all.filter((x) => x !== f.label),
                                                )
                                            }
                                            className="mt-0.5"
                                        />
                                        <span>
                                            <span className="font-medium">{f.label}</span>
                                            {f.description && (
                                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                                    {f.description}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {active.field && (
                            <Field label={active.field} required={active.required}>
                                <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} />
                            </Field>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={close}>
                                Cancel
                            </Button>
                            <Button
                                variant={active.variant}
                                onClick={confirm}
                                disabled={(!!active.required && !text.trim()) || !!active.disabled}
                            >
                                {active.button}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>

            <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
                {current && (
                    <DialogContent className="max-h-[90vh] bg-muted sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Summary Reference Sheet · version {current.no}</DialogTitle>
                            <DialogDescription>
                                The last section of the combined PDF. It can run to several pages.
                            </DialogDescription>
                        </DialogHeader>
                        <SummarySheet
                            library={viewLibrary}
                            typeCode={doc.typeCode}
                            title={doc.title}
                            values={viewValues}
                            derive={derive}
                            versionNo={current.no}
                            hash={current.fileHash}
                            submittedBy={userName(current.submittedBy)}
                            submittedAt={current.submittedAt}
                            createdFrom={
                                sourceDoc ? `${sourceDoc.instanceId} · ${sourceDoc.title} (invalid)` : undefined
                            }
                            flags={issues.filter((i) => i.tier === "FLAG")}
                        />
                    </DialogContent>
                )}
            </Dialog>
        </>
    );
}
