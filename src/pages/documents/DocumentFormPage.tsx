import { ArrowLeft, Info, Lock, Save, Send } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/common";
import { MetadataForm, PdfDropzone, fieldErrors } from "@/components/metadata";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/form";
import { useDemo } from "@/demo/store";
import type { Metadata } from "@/demo/types";

export function DocumentFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { documents, documentTypes, categories, projectId, permissions, actions } = useDemo();
    const existing = id ? documents.find((d) => d.id === id) : undefined;

    const projectTypes = documentTypes.filter((t) => t.projectId === projectId);
    const [typeId, setTypeId] = useState(existing?.typeId ?? "");
    const [title, setTitle] = useState(existing?.title ?? "");
    const [metadata, setMetadata] = useState<Metadata>(existing?.metadata ?? {});
    const [file, setFile] = useState<{ name?: string; sizeKb?: number }>({
        name: existing?.draftFileName,
        sizeKb: existing?.draftFileSizeKb,
    });
    const [showErrors, setShowErrors] = useState(false);

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

    const type = projectTypes.find((t) => t.id === typeId);
    const fields = type?.templates.find((t) => t.no === type.activeTemplateNo)?.fields ?? [];
    const errors = fieldErrors(fields, metadata);
    const sourceDoc = existing?.createdFromId ? documents.find((d) => d.id === existing.createdFromId) : undefined;

    function save(andSubmit: boolean) {
        if (!typeId || !title.trim()) {
            setShowErrors(true);
            toast.error("Choose a document type and enter a title first.");
            return;
        }
        if (andSubmit && (Object.keys(errors).length || !file.name)) {
            setShowErrors(true);
            toast.error("Fill in the required details and upload the PDF before submitting.");
            return;
        }
        const docId = actions.saveDraft(existing?.id ?? null, {
            title: title.trim(),
            typeId,
            metadata,
            fileName: file.name,
            fileSizeKb: file.sizeKb,
        });
        if (andSubmit) {
            actions.submit(docId);
            toast.success("Submitted for approval. The project's Checkers have been notified.");
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
                description="Upload the contract PDF and enter its details. You can save a draft and submit later."
            />

            {sourceDoc && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <Info className="mt-0.5 size-4 text-primary" />
                    <span>
                        Created from invalid document{" "}
                        <Link to={`/documents/${sourceDoc.id}`} className="font-medium text-primary hover:underline">
                            {String(sourceDoc.metadata.contractIdentifier)} · {sourceDoc.title}
                        </Link>
                        . Its reference will appear in this document's Summary Reference Sheet.
                    </span>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6 lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Document</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Field label="Document type" required htmlFor="type">
                                <NativeSelect
                                    id="type"
                                    value={typeId}
                                    aria-invalid={showErrors && !typeId}
                                    onChange={(e) => setTypeId(e.target.value)}
                                    disabled={!!existing?.versions.length}
                                >
                                    <option value="">Select a type…</option>
                                    {categories
                                        .filter((c) => c.projectId === projectId)
                                        .map((c) => (
                                            <optgroup key={c.id} label={c.name}>
                                                {projectTypes
                                                    .filter((t) => t.categoryId === c.id)
                                                    .map((t) => (
                                                        <option key={t.id} value={t.id}>
                                                            {t.name}
                                                        </option>
                                                    ))}
                                            </optgroup>
                                        ))}
                                </NativeSelect>
                            </Field>
                            <Field label="Title" required htmlFor="title" hint="A short name shown in lists and emails">
                                <Input
                                    id="title"
                                    value={title}
                                    aria-invalid={showErrors && !title.trim()}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Grand Residency Hotel Lease"
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

                    <Card>
                        <CardHeader>
                            <CardTitle>Contract details</CardTitle>
                            <CardDescription>
                                {type
                                    ? `Fields for ${type.name} (template v${type.activeTemplateNo}). These go into the Summary Reference Sheet.`
                                    : "Choose a document type to see its fields."}
                            </CardDescription>
                        </CardHeader>
                        {type && (
                            <CardContent>
                                <MetadataForm
                                    fields={fields}
                                    values={metadata}
                                    onChange={setMetadata}
                                    errors={showErrors ? errors : {}}
                                />
                            </CardContent>
                        )}
                        <CardFooter className="justify-end">
                            <Button variant="outline" onClick={() => save(false)}>
                                <Save /> Save draft
                            </Button>
                            <Button onClick={() => save(true)}>
                                <Send /> Submit for approval
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle className="text-sm">What happens next</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                        <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
                            <li>
                                <span className="font-medium text-foreground">1. Save draft.</span> Any Maker in this
                                project can keep editing it.
                            </li>
                            <li>
                                <span className="font-medium text-foreground">2. Submit.</span> The details are frozen
                                as a new version and the project's Checkers are emailed.
                            </li>
                            <li>
                                <span className="font-medium text-foreground">3. Review.</span> A Checker approves it or
                                rejects it with a comment. A rejected document comes back to draft for correction.
                            </li>
                        </ol>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
