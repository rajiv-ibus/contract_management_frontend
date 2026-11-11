// One input per FieldType, with the NOT STATED affordance and this field's issue messages. The caller renders the
// label (and its required star); this renders only the control. Fully controlled: the only local state is a pending
// focus request, so the value never drifts from `props.value`.
import { BanIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NOT_STATED, NOT_STATED_LABEL, allowsNotStated, isNotStated } from "../engine";
import type { FieldDef, FieldInputProps } from "../model";
import { ContactListControl, DateListControl, PersonListControl, TableControl } from "./ListInputs";
import {
    AddressControl,
    BooleanControl,
    CodeControl,
    DateControl,
    DurationControl,
    EnumControl,
    FormulaControl,
    LongTextControl,
    MoneyControl,
    NumericControl,
    PersonControl,
    TextControl,
} from "./ScalarInputs";
import { IssueList, focusById, type ControlProps } from "./shared";

/** Types whose control is a single line, so the NOT STATED toggle can sit beside it on wider screens. */
const INLINE_TYPES: ReadonlySet<FieldDef["type"]> = new Set([
    "text",
    "integer",
    "number",
    "money",
    "percent",
    "date",
    "duration",
    "enum",
    "boolean",
    "code",
    "formula",
]);

/** Whether the control renders a hint line (so the control can reference it with aria-describedby). */
function hasHint(field: FieldDef, entityOptions: string[] | undefined): boolean {
    if (field.type === "formula") return true;
    if (field.type === "code") return !!field.patternHint;
    if (field.type === "text") return !entityOptions && !!field.patternHint && !!field.pattern;
    return false;
}

function Control(props: ControlProps & { entityOptions?: string[] }) {
    switch (props.field.type) {
        case "text":
            return <TextControl {...props} />;
        case "longtext":
            return <LongTextControl {...props} />;
        case "integer":
        case "number":
        case "percent":
            return <NumericControl {...props} />;
        case "money":
            return <MoneyControl {...props} />;
        case "date":
            return <DateControl {...props} />;
        case "duration":
            return <DurationControl {...props} />;
        case "enum":
            return <EnumControl {...props} />;
        case "boolean":
            return <BooleanControl {...props} />;
        case "code":
            return <CodeControl {...props} />;
        case "address":
            return <AddressControl {...props} />;
        case "person":
            return <PersonControl {...props} />;
        case "person_list":
            return <PersonListControl {...props} />;
        case "contact_list":
            return <ContactListControl {...props} />;
        case "table":
            return <TableControl {...props} />;
        case "date_list":
            return <DateListControl {...props} />;
        case "formula":
            return <FormulaControl {...props} />;
        default:
            // A type this build does not know (a library from a newer version): plain text still lets the value be entered.
            return <TextControl {...props} />;
    }
}

export function FieldInput({
    field,
    value,
    onChange,
    issues = [],
    required,
    disabled = false,
    entityOptions,
    id,
}: FieldInputProps) {
    const generatedId = React.useId();
    const baseId = id ?? generatedId;
    const issuesId = `${baseId}-issues`;

    const invalid = issues.some((i) => i.tier === "BLOCK");
    const describedBy =
        [hasHint(field, entityOptions) ? `${baseId}-hint` : null, issues.length > 0 ? issuesId : null]
            .filter(Boolean)
            .join(" ") || undefined;

    const notStated = isNotStated(value);
    const canMarkNotStated = allowsNotStated(field) && !disabled;

    // Switching between the control and the NOT STATED chip swaps which element carries `baseId`. Move focus onto
    // the new one so keyboard users are not dropped back to the top of the page.
    const refocus = React.useRef(false);
    React.useEffect(() => {
        if (!refocus.current) return;
        refocus.current = false;
        focusById(baseId);
    });

    const setNotStated = () => {
        refocus.current = true;
        onChange(NOT_STATED);
    };
    const enterValue = () => {
        refocus.current = true;
        onChange(undefined);
    };

    const shared = { id: baseId, invalid, required, disabled, describedBy };

    const toggle = canMarkNotStated ? (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 self-start text-muted-foreground"
            title="The agreement is silent on this"
            aria-label={`Mark ${field.label} as not stated`}
            onClick={setNotStated}
        >
            <BanIcon />
            Not stated
        </Button>
    ) : null;

    let body: React.ReactNode;
    if (notStated) {
        body = (
            <div
                // The chip, not its button, carries the field's id: a click on the field's <label htmlFor> would
                // otherwise press "Enter a value" and discard NOT STATED.
                id={baseId}
                role="group"
                aria-label={`${field.label}: ${NOT_STATED_LABEL}`}
                className={cn(
                    "flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-dashed border-input bg-muted/50 px-3 py-1",
                    invalid && "border-destructive",
                )}
            >
                <span className="text-sm font-bold tracking-wide">{NOT_STATED_LABEL}</span>
                {!disabled && (
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        aria-label={`Enter a value for ${field.label}`}
                        aria-describedby={issues.length > 0 ? issuesId : undefined}
                        onClick={enterValue}
                    >
                        Enter a value
                    </Button>
                )}
            </div>
        );
    } else {
        const control = (
            <div className="flex min-w-0 flex-col gap-1.5 sm:flex-1">
                <Control
                    field={field}
                    value={value}
                    onChange={onChange}
                    shared={shared}
                    entityOptions={entityOptions}
                />
            </div>
        );
        body = INLINE_TYPES.has(field.type) ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                {control}
                {toggle}
            </div>
        ) : (
            <div className="flex flex-col gap-2">
                {control}
                {toggle}
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            {body}
            <IssueList id={issuesId} issues={issues} />
        </div>
    );
}
