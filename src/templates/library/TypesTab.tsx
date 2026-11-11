import { EyeIcon, FileTextIcon, RotateCcwIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { composeFields, countByTier, emptyValues, levelCounts, validateDocument } from "../engine";
import type { DeriveContext, DocumentTypeDef, DocumentValues, FieldLibrary } from "../model";
import { TemplateForm } from "../TemplateForm";
import { TierBadge, useRetained } from "./shared";

export function TypesTab({ library }: { library: FieldLibrary }) {
    // `id` makes every opening a fresh preview, so earlier entries never carry over.
    const [previewing, setPreviewing] = useState<{ type: DocumentTypeDef; id: number } | null>(null);
    const shown = useRetained(previewing);

    const cards = useMemo(
        () =>
            library.documentTypes.map((type) => {
                const fields = composeFields(library, type.code);
                return {
                    type,
                    family: library.families.find((f) => f.code === type.family)?.name ?? type.family,
                    total: fields.length,
                    levels: levelCounts(fields),
                    mandatory: fields.filter((f) => f.req === "M").length,
                    conditional: fields.filter((f) => f.req === "C").length,
                };
            }),
        [library],
    );

    if (cards.length === 0) {
        return (
            <Card>
                <EmptyState
                    icon={FileTextIcon}
                    title="No document types"
                    text="Add document types to the library JSON to see them here."
                />
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
                What each document type is made of: the L1 fields every type has, its family's L2 fields and its own L3
                fields. Open the preview to see the form a Maker gets.
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map((c) => (
                    <Card key={c.type.code}>
                        <CardContent className="flex h-full flex-col gap-4">
                            <div className="min-w-0">
                                <p className="font-mono text-xs text-muted-foreground">{c.type.code}</p>
                                <h3 className="text-base leading-snug font-semibold">{c.type.name}</h3>
                                <p className="text-sm text-muted-foreground">Family: {c.family}</p>
                            </div>

                            <div>
                                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    Parties
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {c.type.parties.map((p) => (
                                        <Badge
                                            key={p.role}
                                            variant={p.internal ? "default" : "outline"}
                                            title={
                                                p.internal
                                                    ? "Internal: picks an entity from the entity master"
                                                    : "External party"
                                            }
                                        >
                                            {p.role}
                                            {p.internal && <span className="opacity-70">internal</span>}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    Fields on this type
                                </p>
                                <dl className="grid grid-cols-4 gap-2 text-center">
                                    <Count label="L1" value={c.levels.L1} />
                                    <Count label="L2" value={c.levels.L2} />
                                    <Count label="L3" value={c.levels.L3} />
                                    <Count label="Total" value={c.total} strong />
                                </dl>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {c.mandatory} mandatory
                                    {c.conditional > 0 && `, ${c.conditional} conditional`}
                                </p>
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-auto self-start"
                                onClick={() => setPreviewing({ type: c.type, id: Date.now() })}
                            >
                                <EyeIcon />
                                Preview form
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={previewing !== null} onOpenChange={(open) => !open && setPreviewing(null)}>
                <DialogContent className="max-h-[85vh] gap-0 sm:max-w-5xl overflow-hidden p-0">
                    {shown && <PreviewBody key={shown.id} library={library} type={shown.type} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Count({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
    return (
        <div className="rounded-md bg-muted/60 px-2 py-1.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={strong ? "text-lg font-semibold tabular-nums" : "text-lg tabular-nums"}>{value}</dd>
        </div>
    );
}

// Values the system would fill in for a real document; here they are labelled as preview values.
const PREVIEW_DERIVE: Omit<DeriveContext, "documentTypeCode"> = {
    instanceId: "Assigned on first submission",
    status: "Draft",
    preparedBy: "Maker (preview)",
    verifiedBy: "Filled on approval",
    fileRef: "Filled when the PDF is stored",
};

function PreviewBody({ library, type }: { library: FieldLibrary; type: DocumentTypeDef }) {
    const [values, setValues] = useState<DocumentValues>(emptyValues);

    const fields = useMemo(() => composeFields(library, type.code, values.custom), [library, type.code, values.custom]);
    const issues = useMemo(() => validateDocument(library, fields, type, values), [library, fields, type, values]);
    const derive = useMemo<DeriveContext>(() => ({ ...PREVIEW_DERIVE, documentTypeCode: type.code }), [type.code]);
    const tiers = countByTier(issues);

    return (
        <>
            <DialogHeader className="gap-2 border-b px-6 py-4">
                <DialogTitle>
                    {type.name} <span className="font-mono text-sm font-normal text-muted-foreground">{type.code}</span>
                </DialogTitle>
                <DialogDescription asChild>
                    <div className="flex flex-wrap items-center gap-2">
                        <span>
                            This is the form a Maker sees. Nothing you enter here is saved. The checks below are the
                            live validation result.
                        </span>
                        {(["BLOCK", "WARN", "FLAG"] as const).map((tier) => (
                            <span key={tier} className="inline-flex items-center gap-1">
                                <TierBadge tier={tier} />
                                <span className="text-xs tabular-nums">{tiers[tier]}</span>
                            </span>
                        ))}
                        <Button variant="ghost" size="sm" onClick={() => setValues(emptyValues())}>
                            <RotateCcwIcon />
                            Clear
                        </Button>
                    </div>
                </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-6 py-5">
                <TemplateForm
                    library={library}
                    typeCode={type.code}
                    values={values}
                    onChange={setValues}
                    issues={issues}
                    derive={derive}
                    disabled={false}
                />
            </div>
        </>
    );
}
