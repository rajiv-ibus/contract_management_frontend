import { BuildingIcon, PlusIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";

import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { FieldLibrary } from "../model";
import { sameList } from "./describe";

interface EntitiesTabProps {
    library: FieldLibrary;
    entities: string[];
    onEntitiesChange: (next: string[]) => void;
    onSave: (next: FieldLibrary) => void;
}

export function EntitiesTab({ library, entities, onEntitiesChange, onSave }: EntitiesTabProps) {
    const [draft, setDraft] = useState("");
    const [problem, setProblem] = useState("");
    const problemId = useId();

    const changed = !sameList(entities, library.entityMaster);
    const internalRoles = library.documentTypes.reduce((n, t) => n + t.parties.filter((p) => p.internal).length, 0);

    const add = () => {
        const name = draft.trim().replace(/\s+/g, " ");
        if (!name) {
            setProblem("Enter the legal entity's name.");
            return;
        }
        if (entities.some((e) => e.toLowerCase() === name.toLowerCase())) {
            setProblem("That entity is already in the list.");
            return;
        }
        onEntitiesChange([...entities, name]);
        setDraft("");
        setProblem("");
    };

    const save = () => onSave({ ...library, entityMaster: entities, version: library.version + 1 });

    return (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <Card>
                <CardHeader>
                    <CardTitle>iBUS legal entities</CardTitle>
                    <CardDescription>
                        The closed list of iBUS legal entities. Internal parties on a document pick their entity from
                        this list; free text is not accepted. Changes stay here until you save them as a new version.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <form
                        className="flex flex-col gap-1.5"
                        onSubmit={(e) => {
                            e.preventDefault();
                            add();
                        }}
                    >
                        <div className="flex gap-2">
                            <Input
                                value={draft}
                                onChange={(e) => {
                                    setDraft(e.target.value);
                                    setProblem("");
                                }}
                                placeholder="Legal name of the entity"
                                aria-label="New entity name"
                                aria-invalid={problem ? true : undefined}
                                aria-describedby={problem ? problemId : undefined}
                            />
                            <Button type="submit" variant="outline">
                                <PlusIcon />
                                Add
                            </Button>
                        </div>
                        {problem && (
                            <p id={problemId} role="alert" className="text-xs text-destructive">
                                {problem}
                            </p>
                        )}
                    </form>

                    {entities.length === 0 ? (
                        <EmptyState
                            icon={BuildingIcon}
                            title="The entity master is empty"
                            text="Internal parties will have nothing to choose from until an entity is added."
                        />
                    ) : (
                        <ul className="divide-y rounded-lg border">
                            {entities.map((name, index) => (
                                // A pasted library can repeat a name, so the position is part of the key.
                                <li key={`${index}-${name}`} className="flex items-center gap-3 px-3 py-2">
                                    <BuildingIcon className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 flex-1 text-sm">{name}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => onEntitiesChange(entities.filter((_, i) => i !== index))}
                                        aria-label={`Remove ${name}`}
                                        title="Remove"
                                    >
                                        <Trash2Icon className="text-destructive" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                        <Button onClick={save} disabled={!changed}>
                            <SaveIcon />
                            Save as version {library.version + 1}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                onEntitiesChange(library.entityMaster);
                                setProblem("");
                            }}
                            disabled={!changed}
                        >
                            <RotateCcwIcon />
                            Discard changes
                        </Button>
                        {changed && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
                    </div>
                </CardContent>
            </Card>

            <Card className="self-start">
                <CardContent className="flex flex-col gap-2 text-sm">
                    <p className="font-medium">Where this list is used</p>
                    <p className="text-muted-foreground">
                        {internalRoles} internal party role{internalRoles === 1 ? "" : "s"} across{" "}
                        {library.documentTypes.length} document types pick from this list.
                    </p>
                    <p className="text-muted-foreground">
                        Removing an entity does not change documents already submitted: they keep the version they were
                        submitted with.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
