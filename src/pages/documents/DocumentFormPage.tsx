import { ArrowLeft, Info, Lock, Save, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/common";
import { PdfDropzone } from "@/components/PdfDropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/Field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { deriveContext, documentIssues, nonBlocking, submitLibrary } from "@/demo/docs";
import { useDemo, useLookups } from "@/demo/store";
import { completion, composeFields, countByTier, emptyValues } from "@/templates/engine";
import type { DocumentValues } from "@/templates/model";
import { TemplateForm } from "@/templates/TemplateForm";

export function DocumentFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { documents, libraries, projectId, permissions, currentUser, actions } = useDemo();
    const { userName, projectName } = useLookups();
    const existing = id ? documents.find((d) => d.id === id) : undefined;

    const library = useMemo(() => submitLibrary(libraries[projectId]), [libraries, projectId]);
    const [typeCode, setTypeCode] = useState(existing?.typeCode ?? "");
    const [title, setTitle] = useState(existing?.title ?? "");
    const [values, setValues] = useState<DocumentValues>(existing?.values ?? emptyValues());
    const [file, setFile] = useState<{ name?: string; sizeKb?: number }>({
        name: existing?.draftFileName,
        sizeKb: existing?.draftFileSizeKb,
    });
    const [showErrors, setShowErrors] = useState(false);

    const type = library.documentTypes.find((t) => t.code === typeCode);
    const fields = useMemo(
        () => (type ? composeFields(library, typeCode, values.custom) : []),
        [library, type, typeCode, values.custom],
    );
    const allIssues = useMemo(
        () => documentIssues(libraries[projectId], typeCode, values),
        [libraries, projectId, typeCode, values],
    );
    const counts = countByTier(allIssues);
    const progress = completion(fields, values.fields);
    // Required-field errors only appear after the first attempt to submit; warnings and notes show as you type.
    const issues = showErrors ? allIssues : nonBlocking(allIssues);

    if (!permissions.canMake) {
        return <EmptyState icon={Lock} title="Only Makers can create or edit documents" />;
    }
    if (id && (!existing || existing.status !== "DRAFT")) {
        return (
            <EmptyState
                icon={Lock}
                title="This document can't be edited"
                text="Only drafts can be edited. Reopen a rejected document first; approved documents are locked."
            />
        );
    }

    const sourceDoc = existing?.createdFromId ? documents.find((d) => d.id === existing.createdFromId) : undefined;
    const derive = deriveContext(
        { instanceId: existing?.instanceId, typeCode, status: existing?.status ?? "DRAFT", attestation: undefined },
        { preparedBy: existing ? userName(existing.createdById) : currentUser.name },
    );

    function changeType(next: string) {
        const nextType = library.documentTypes.find((t) => t.code === next);
        const roles = new Set(nextType?.parties.map((r) => r.role));
        setTypeCode(next);
        setValues((v) => ({ ...v, parties: v.parties.filter((p) => roles.has(p.role)) }));
    }

    function save(andSubmit: boolean) {
        if (!typeCode || !title.trim()) {
            setShowErrors(true);
            toast.error("Choose a document type and enter a name first.");
            return;
        }
        if (andSubmit) {
            setShowErrors(true);
            if (counts.BLOCK > 0 || !file.name) {
                toast.error(
                    !file.name && counts.BLOCK === 0
                        ? "Upload the contract PDF before submitting."
                        : `${counts.BLOCK + (file.name ? 0 : 1)} things must be fixed before this can be submitted.`,
                );
                return;
            }
        }
        const docId = actions.saveDraft(existing?.id ?? null, {
            title: title.trim(),
            typeCode,
            values,
            fileName: file.name,
            fileSizeKb: file.sizeKb,
        });
        if (andSubmit) {
            actions.submit(docId);
            toast.success(
                counts.WARN > 0
                    ? `Submitted. The Checker will see ${counts.WARN} warning${counts.WARN === 1 ? "" : "s"}.`
                    : "Submitted for approval. The project's Checkers have been notified.",
            );
        } else {
            toast.success("Draft saved.");
        }
        navigate(`/documents/${docId}`);
    }

    return (
        <>
            <Link
                to={existing ? `/documents/${existing.id}` : "/documents"}
                className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-4" /> Back
            </Link>
            <PageHeader
                title={existing ? "Edit draft" : "New document"}
                description={`This contract will belong to the ${projectName(existing?.projectId ?? projectId)} project, and only its members can see it. Upload the contract PDF and enter its details; you can save a draft and submit later.`}
                actions={
                    <>
                        <Button variant="outline" onClick={() => save(false)}>
                            <Save /> Save draft
                        </Button>
                        <Button onClick={() => save(true)}>
                            <Send /> Submit for approval
                        </Button>
                    </>
                }
            />

            {sourceDoc && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <Info className="mt-0.5 size-4 text-primary" />
                    <span>
                        Created from invalid document{" "}
                        <Link to={`/documents/${sourceDoc.id}`} className="font-medium text-primary hover:underline">
                            {sourceDoc.instanceId} · {sourceDoc.title}
                        </Link>
                        . Its reference will appear in this document's Summary Reference Sheet.
                    </span>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Document</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Field label="Document type" required htmlFor="type">
                                <NativeSelect
                                    id="type"
                                    value={typeCode}
                                    aria-invalid={showErrors && !typeCode}
                                    onChange={(e) => changeType(e.target.value)}
                                    disabled={!!existing?.versions.length}
                                >
                                    <option value="">Select a type…</option>
                                    {library.families.map((family) => (
                                        <optgroup key={family.code} label={family.name}>
                                            {library.documentTypes
                                                .filter((t) => t.family === family.code)
                                                .map((t) => (
                                                    <option key={t.code} value={t.code}>
                                                        {t.name}
                                                    </option>
                                                ))}
                                        </optgroup>
                                    ))}
                                </NativeSelect>
                            </Field>
                            <Field label="Name" required htmlFor="title" hint="Shown in lists and emails">
                                <Input
                                    id="title"
                                    value={title}
                                    aria-invalid={showErrors && !title.trim()}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Chennai hub warehouse services"
                                />
                            </Field>
                            <div className="sm:col-span-2">
                                <Field label="Contract PDF" required>
                                    <PdfDropzone
                                        fileName={file.name}
                                        fileSizeKb={file.sizeKb}
                                        onFile={(name, sizeKb) => setFile({ name, sizeKb })}
                                        onClear={() => setFile({})}
                                        error={showErrors && !file.name ? "Upload the contract PDF" : undefined}
                                    />
                                </Field>
                            </div>
                        </CardContent>
                    </Card>

                    {type ? (
                        <TemplateForm
                            library={library}
                            typeCode={typeCode}
                            values={values}
                            onChange={setValues}
                            issues={issues}
                            derive={derive}
                        />
                    ) : (
                        <Card>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    Choose a document type to see its parties and fields.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
                    {type && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Progress</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3 pt-3 text-sm">
                                <div>
                                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                        <span>Mandatory fields answered</span>
                                        <span>
                                            {progress.done} / {progress.total}
                                        </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full bg-primary transition-all"
                                            style={{
                                                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                                <ul className="flex flex-col gap-1 text-xs">
                                    <li className="text-destructive">{counts.BLOCK} must be fixed to submit</li>
                                    <li className="text-amber-700">{counts.WARN} warnings for the Checker</li>
                                    <li className="text-sky-700">{counts.FLAG} notes for the signer</li>
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">What happens next</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-3">
                            <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
                                <li>
                                    <span className="font-medium text-foreground">1. Save draft.</span> Any Maker in
                                    this project can keep editing it.
                                </li>
                                <li>
                                    <span className="font-medium text-foreground">2. Submit.</span> The details are
                                    frozen as a new version and the project's Checkers are emailed.
                                </li>
                                <li>
                                    <span className="font-medium text-foreground">3. Review.</span> A Checker approves
                                    it or rejects it with a comment. A rejected document comes back to draft.
                                </li>
                            </ol>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
