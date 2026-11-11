import { BracesIcon, BuildingIcon, DownloadIcon, FileTextIcon, ListChecksIcon, ScaleIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EntitiesTab } from "./library/EntitiesTab";
import { FieldsTab } from "./library/FieldsTab";
import { JsonTab } from "./library/JsonTab";
import { RulesTab } from "./library/RulesTab";
import { TabBoundary } from "./library/TabBoundary";
import { TypesTab } from "./library/TypesTab";
import { sameList } from "./library/describe";
import { downloadText, fileSlug, useRetained } from "./library/shared";
import type { FieldLibrary } from "./model";

export interface LibraryManagerProps {
    library: FieldLibrary;
    projectName: string;
    onSave: (next: FieldLibrary) => void;
}

type Editor = "entities" | "json";

const EDITOR_NAME: Record<Editor, string> = { entities: "Entity master", json: "Edit JSON" };

// Tabs stay mounted (hidden) so filters, the JSON text and entity edits survive switching tabs.
const KEEP = { forceMount: true as const, className: "data-[state=inactive]:hidden" };
const TRIGGER = "shrink-0 whitespace-nowrap";

function UnsavedDot() {
    return (
        <>
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            <span className="sr-only">(unsaved changes)</span>
        </>
    );
}

/**
 * The project Admin's view of the field library: browse it, preview the forms it produces, and save changes as a
 * new frozen version. Edits stay in memory until onSave is called.
 *
 * The Entity master and Edit JSON tabs are two separate editors of the same library, each saving on its own. A save
 * from one replaces the other's unsaved edits, so the Admin is asked first when there are any. A saved version
 * resets both editors but leaves the active tab and the browsing filters alone.
 */
export function LibraryManager({ library, projectName, onSave }: LibraryManagerProps) {
    const baselineJson = useMemo(() => JSON.stringify(library, null, 2), [library]);
    const [entities, setEntities] = useState(library.entityMaster);
    const [json, setJson] = useState(baselineJson);
    const [seenVersion, setSeenVersion] = useState(library.version);
    const [pending, setPending] = useState<{ next: FieldLibrary; source: Editor } | null>(null);
    const shownPending = useRetained(pending);

    // A new version replaces whatever the editors held.
    if (seenVersion !== library.version) {
        setSeenVersion(library.version);
        setEntities(library.entityMaster);
        setJson(baselineJson);
        if (pending) setPending(null);
    }

    const dirty: Record<Editor, boolean> = {
        entities: !sameList(entities, library.entityMaster),
        json: json !== baselineJson,
    };

    const commit = (next: FieldLibrary, source: Editor) => {
        onSave(next);
        toast.success(
            source === "entities"
                ? `Entity master saved as version ${next.version}`
                : `Saved as version ${next.version}`,
        );
    };

    const requestSave = (source: Editor) => (next: FieldLibrary) => {
        const other: Editor = source === "entities" ? "json" : "entities";
        if (dirty[other]) setPending({ next, source });
        else commit(next, source);
    };

    const stats = [
        { label: "Fields", value: library.fields.length },
        { label: "Document types", value: library.documentTypes.length },
        { label: "Rules", value: library.rules.length },
    ];

    return (
        <div className="flex flex-col gap-4">
            <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
                <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Field library</p>
                    <p className="flex items-center gap-2 text-base font-semibold">
                        <span className="truncate">{projectName}</span>
                        <Badge>Version {library.version}</Badge>
                    </p>
                </div>
                <dl className="flex flex-wrap gap-x-8 gap-y-2">
                    {stats.map((s) => (
                        <div key={s.label}>
                            <dt className="text-xs text-muted-foreground">{s.label}</dt>
                            <dd className="text-xl font-semibold tabular-nums">{s.value}</dd>
                        </div>
                    ))}
                </dl>
                <Button
                    variant="outline"
                    className="sm:ml-auto"
                    onClick={() =>
                        downloadText(
                            `${fileSlug(projectName)}-field-library-v${library.version}.json`,
                            JSON.stringify(library, null, 2),
                        )
                    }
                >
                    <DownloadIcon />
                    Export
                </Button>
            </Card>

            <Tabs defaultValue="fields">
                <TabsList className="overflow-x-auto">
                    <TabsTrigger value="fields" className={TRIGGER}>
                        <ListChecksIcon />
                        Fields
                    </TabsTrigger>
                    <TabsTrigger value="types" className={TRIGGER}>
                        <FileTextIcon />
                        Document types
                    </TabsTrigger>
                    <TabsTrigger value="rules" className={TRIGGER}>
                        <ScaleIcon />
                        Rules
                    </TabsTrigger>
                    <TabsTrigger value="entities" className={TRIGGER}>
                        <BuildingIcon />
                        Entity master
                        {dirty.entities && <UnsavedDot />}
                    </TabsTrigger>
                    <TabsTrigger value="json" className={TRIGGER}>
                        <BracesIcon />
                        Edit JSON
                        {dirty.json && <UnsavedDot />}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="fields" {...KEEP}>
                    <TabBoundary resetKey={library}>
                        <FieldsTab library={library} />
                    </TabBoundary>
                </TabsContent>
                <TabsContent value="types" {...KEEP}>
                    <TabBoundary resetKey={library}>
                        <TypesTab library={library} />
                    </TabBoundary>
                </TabsContent>
                <TabsContent value="rules" {...KEEP}>
                    <TabBoundary resetKey={library}>
                        <RulesTab library={library} />
                    </TabBoundary>
                </TabsContent>
                {/* Keyed by version so a saved version also clears each editor's draft and check result. */}
                <TabsContent value="entities" {...KEEP}>
                    <TabBoundary resetKey={library}>
                        <EntitiesTab
                            key={library.version}
                            library={library}
                            entities={entities}
                            onEntitiesChange={setEntities}
                            onSave={requestSave("entities")}
                        />
                    </TabBoundary>
                </TabsContent>
                <TabsContent value="json" {...KEEP}>
                    <TabBoundary resetKey={library}>
                        <JsonTab
                            key={library.version}
                            library={library}
                            projectName={projectName}
                            text={json}
                            onTextChange={setJson}
                            onSave={requestSave("json")}
                        />
                    </TabBoundary>
                </TabsContent>
            </Tabs>

            <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
                <DialogContent className="sm:max-w-md">
                    {shownPending && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Discard unsaved changes?</DialogTitle>
                                <DialogDescription>
                                    The {EDITOR_NAME[shownPending.source === "entities" ? "json" : "entities"]} tab has
                                    changes that are not saved. Saving from the {EDITOR_NAME[shownPending.source]} tab
                                    replaces them with version {shownPending.next.version}.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setPending(null)}>
                                    Keep editing
                                </Button>
                                <Button
                                    onClick={() => {
                                        commit(shownPending.next, shownPending.source);
                                        setPending(null);
                                    }}
                                >
                                    Save and discard them
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
