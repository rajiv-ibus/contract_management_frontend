// Single-value inputs: everything except the add/remove list types. Each one is controlled by `value` and reports
// the next value through `onChange`; a cleared control reports `undefined`. Nothing is trimmed or coerced.
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DEFAULT_UNITS } from "../engine";
import {
    DEFAULT_CURRENCY,
    asAddress,
    asDuration,
    asMoney,
    asPerson,
    asText,
    capitalize,
    nextAddress,
    nextDuration,
    nextMoney,
    nextPerson,
    nextText,
    prefersUppercase,
    todayIso,
    withCurrent,
} from "./helpers";
import { Hint, SubField, WithSuffix, controlAria, subId, type ControlProps } from "./shared";

const MONO = "font-mono";

// ---------------------------------------------------------------------------------------------------------------
// text, longtext, code, formula
// ---------------------------------------------------------------------------------------------------------------

export function TextControl({
    field,
    value,
    onChange,
    shared,
    entityOptions,
}: ControlProps & { entityOptions?: string[] }) {
    const text = asText(value);

    // The iBUS contracting entity must come from the entity master, so free text is not offered at all.
    if (field.type === "text" && entityOptions) {
        return (
            <NativeSelect
                {...controlAria(shared, shared.id, field.label)}
                value={text}
                onChange={(e) => onChange(nextText(e.target.value))}
            >
                <option value="">Select an entity</option>
                {withCurrent(entityOptions, text).map((o) => (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ))}
            </NativeSelect>
        );
    }

    return (
        <>
            <Input
                {...controlAria(shared, shared.id, field.label)}
                type="text"
                autoComplete="off"
                value={text}
                onChange={(e) => onChange(nextText(e.target.value))}
            />
            {field.patternHint && field.pattern && <Hint id={`${shared.id}-hint`}>Format: {field.patternHint}</Hint>}
        </>
    );
}

export function LongTextControl({ field, value, onChange, shared }: ControlProps) {
    return (
        <Textarea
            {...controlAria(shared, shared.id, field.label)}
            rows={4}
            value={asText(value)}
            onChange={(e) => onChange(nextText(e.target.value))}
        />
    );
}

/** A reference code: monospace, no autocorrect, and upper-cased as typed when its pattern only allows capitals. */
export function CodeControl({ field, value, onChange, shared }: ControlProps) {
    const upper = prefersUppercase(field);
    return (
        <>
            <Input
                {...controlAria(shared, shared.id, field.label)}
                type="text"
                className={cn(MONO, upper && "uppercase placeholder:normal-case")}
                autoComplete="off"
                autoCapitalize={upper ? "characters" : "off"}
                autoCorrect="off"
                spellCheck={false}
                value={asText(value)}
                onChange={(e) => {
                    const el = e.currentTarget;
                    const raw = el.value;
                    const next = upper ? raw.toUpperCase() : raw;
                    if (next !== raw) {
                        // Upper-casing rewrites the DOM value, which would throw the caret to the end.
                        const caret = el.selectionStart;
                        requestAnimationFrame(() => {
                            if (caret !== null && document.activeElement === el) el.setSelectionRange(caret, caret);
                        });
                    }
                    onChange(nextText(next));
                }}
            />
            {field.patternHint && <Hint id={`${shared.id}-hint`}>Format: {field.patternHint}</Hint>}
        </>
    );
}

export function FormulaControl({ field, value, onChange, shared }: ControlProps) {
    return (
        <>
            <Input
                {...controlAria(shared, shared.id, field.label)}
                type="text"
                className={MONO}
                autoComplete="off"
                spellCheck={false}
                value={asText(value)}
                onChange={(e) => onChange(nextText(e.target.value))}
            />
            <Hint id={`${shared.id}-hint`}>Formula or amount</Hint>
        </>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// integer, number, percent
// ---------------------------------------------------------------------------------------------------------------

/** Numbers are text boxes, not type="number": the string is kept exactly as typed ("007", "1e3", "12.50"). */
export function NumericControl({ field, value, onChange, shared }: ControlProps) {
    const percent = field.type === "percent";
    const input = (
        <Input
            {...controlAria(shared, shared.id, field.label)}
            type="text"
            inputMode={field.type === "integer" ? "numeric" : "decimal"}
            autoComplete="off"
            className={percent ? "pr-8" : undefined}
            value={asText(value)}
            onChange={(e) => onChange(nextText(e.target.value))}
        />
    );
    return percent ? <WithSuffix suffix="%">{input}</WithSuffix> : input;
}

// ---------------------------------------------------------------------------------------------------------------
// money
// ---------------------------------------------------------------------------------------------------------------

export function MoneyControl({ field, value, onChange, shared }: ControlProps) {
    const currencies = field.currencies?.length ? field.currencies : [DEFAULT_CURRENCY];
    const defaultCurrency = currencies[0];
    const money = asMoney(value, defaultCurrency);
    const periods = field.periods?.length ? field.periods : undefined;
    const emit = (patch: Partial<typeof money>) => onChange(nextMoney(money, patch, defaultCurrency));

    return (
        <div
            className={cn(
                "grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2",
                periods && "sm:grid-cols-[minmax(0,1fr)_5.5rem_11rem]",
            )}
        >
            <Input
                {...controlAria(shared, shared.id, `${field.label} amount`)}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={money.amount}
                onChange={(e) => emit({ amount: e.target.value })}
            />
            <NativeSelect
                {...controlAria(shared, subId(shared, "currency"), `${field.label} currency`)}
                value={money.currency}
                onChange={(e) => emit({ currency: e.target.value })}
            >
                {withCurrent(currencies, money.currency).map((c) => (
                    <option key={c} value={c}>
                        {c}
                    </option>
                ))}
            </NativeSelect>
            {periods && (
                <div className="col-span-2 sm:col-span-1">
                    <NativeSelect
                        {...controlAria(shared, subId(shared, "period"), `${field.label} period`)}
                        value={money.period ?? ""}
                        onChange={(e) => emit({ period: e.target.value })}
                    >
                        <option value="">Select period</option>
                        {withCurrent(periods, money.period).map((p) => (
                            <option key={p} value={p}>
                                {capitalize(p)}
                            </option>
                        ))}
                    </NativeSelect>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------------------------------------------

export function DateControl({ field, value, onChange, shared }: ControlProps) {
    return (
        <Input
            {...controlAria(shared, shared.id, field.label)}
            type="date"
            className="sm:max-w-56"
            max={field.notInFuture ? todayIso() : undefined}
            value={asText(value)}
            onChange={(e) => onChange(nextText(e.target.value))}
        />
    );
}

// ---------------------------------------------------------------------------------------------------------------
// duration
// ---------------------------------------------------------------------------------------------------------------

/** A number and its unit. The unit has no default: "a bare numeral is invalid", so it must be chosen. */
export function DurationControl({ field, value, onChange, shared }: ControlProps) {
    const duration = asDuration(value);
    const units = field.units?.length ? field.units : DEFAULT_UNITS;
    const emit = (patch: Partial<typeof duration>) => onChange(nextDuration(duration, patch));

    return (
        <div className="flex gap-2">
            <Input
                {...controlAria(shared, shared.id, `${field.label} number`)}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="min-w-0 flex-1"
                value={duration.value}
                onChange={(e) => emit({ value: e.target.value })}
            />
            <div className="w-32 shrink-0">
                <NativeSelect
                    {...controlAria(shared, subId(shared, "unit"), `${field.label} unit`)}
                    value={duration.unit}
                    onChange={(e) => emit({ unit: e.target.value as typeof duration.unit })}
                >
                    <option value="">Select unit</option>
                    {withCurrent(units, duration.unit).map((u) => (
                        <option key={u} value={u}>
                            {capitalize(u)}
                        </option>
                    ))}
                </NativeSelect>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// enum
// ---------------------------------------------------------------------------------------------------------------

export function EnumControl({ field, value, onChange, shared }: ControlProps) {
    const text = asText(value);
    return (
        <NativeSelect
            {...controlAria(shared, shared.id, field.label)}
            value={text}
            onChange={(e) => onChange(nextText(e.target.value))}
        >
            <option value="">Select</option>
            {withCurrent(field.options ?? [], text).map((o) => (
                <option key={o} value={o}>
                    {o}
                </option>
            ))}
        </NativeSelect>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// boolean
// ---------------------------------------------------------------------------------------------------------------

const YES_NO = [
    { label: "Yes", value: true },
    { label: "No", value: false },
] as const;

/** Yes / No as a radio group styled as a segmented control. Arrow keys move and select, as radios do. */
export function BooleanControl({ field, value, onChange, shared }: ControlProps) {
    const current = typeof value === "boolean" ? value : undefined;
    const buttons = React.useRef<(HTMLButtonElement | null)[]>([]);

    const choose = (index: number) => {
        onChange(YES_NO[index].value);
        buttons.current[index]?.focus();
    };

    return (
        <div className="flex items-center gap-2">
            <div
                // The group, not a radio, carries the field's id: a click on the field's <label htmlFor> would
                // otherwise select Yes.
                id={shared.id}
                role="radiogroup"
                aria-label={field.label}
                aria-required={shared.required || undefined}
                aria-invalid={shared.invalid || undefined}
                aria-describedby={shared.describedBy}
                className={cn(
                    "inline-flex rounded-md border border-input bg-card p-0.5 shadow-xs",
                    shared.invalid && "border-destructive",
                    shared.disabled && "opacity-70",
                )}
            >
                {YES_NO.map((choice, i) => {
                    const checked = current === choice.value;
                    return (
                        <button
                            key={choice.label}
                            ref={(el) => {
                                buttons.current[i] = el;
                            }}
                            id={subId(shared, i === 0 ? "yes" : "no")}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            disabled={shared.disabled}
                            // Roving tab stop: the chosen option, or either one while nothing is chosen.
                            tabIndex={checked || current === undefined ? 0 : -1}
                            onClick={() => choose(i)}
                            onKeyDown={(e) => {
                                if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) {
                                    e.preventDefault();
                                    choose((i + 1) % YES_NO.length);
                                }
                            }}
                            className={cn(
                                "h-8 min-w-14 rounded-[5px] px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed",
                                checked
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted",
                            )}
                        >
                            {choice.label}
                        </button>
                    );
                })}
            </div>
            {current !== undefined && !shared.disabled && (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="px-1"
                    aria-label={`Clear ${field.label}`}
                    onClick={() => onChange(undefined)}
                >
                    Clear
                </Button>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// address
// ---------------------------------------------------------------------------------------------------------------

export function AddressControl({ field, value, onChange, shared }: ControlProps) {
    const address = asAddress(value);
    const emit = (patch: Partial<typeof address>) => onChange(nextAddress(address, patch));
    // Visible sub-labels name each box; the aria-label adds which field it belongs to ("Registered office, City").
    const aria = (name: string, label: string, required: boolean) =>
        controlAria(
            shared,
            name === "line1" ? shared.id : subId(shared, name),
            `${field.label}, ${label}`,
            required && shared.required,
        );
    const idOf = (name: string) => (name === "line1" ? shared.id : subId(shared, name));

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SubField label="Address line 1" htmlFor={idOf("line1")} className="sm:col-span-2">
                <Input
                    {...aria("line1", "Address line 1", true)}
                    type="text"
                    autoComplete="off"
                    value={address.line1}
                    onChange={(e) => emit({ line1: e.target.value })}
                />
            </SubField>
            <SubField label="Address line 2" htmlFor={idOf("line2")} className="sm:col-span-2">
                <Input
                    {...aria("line2", "Address line 2", false)}
                    type="text"
                    autoComplete="off"
                    value={address.line2}
                    onChange={(e) => emit({ line2: e.target.value })}
                />
            </SubField>
            <SubField label="City" htmlFor={idOf("city")}>
                <Input
                    {...aria("city", "City", true)}
                    type="text"
                    autoComplete="off"
                    value={address.city}
                    onChange={(e) => emit({ city: e.target.value })}
                />
            </SubField>
            <SubField label="State" htmlFor={idOf("state")}>
                <Input
                    {...aria("state", "State", true)}
                    type="text"
                    autoComplete="off"
                    value={address.state}
                    onChange={(e) => emit({ state: e.target.value })}
                />
            </SubField>
            <SubField label="PIN code" htmlFor={idOf("pin")}>
                <Input
                    {...aria("pin", "PIN code", true)}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={address.pin}
                    onChange={(e) => emit({ pin: e.target.value })}
                />
            </SubField>
            <SubField label="Country" htmlFor={idOf("country")}>
                <Input
                    {...aria("country", "Country", false)}
                    type="text"
                    autoComplete="off"
                    value={address.country}
                    onChange={(e) => emit({ country: e.target.value })}
                />
            </SubField>
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// person
// ---------------------------------------------------------------------------------------------------------------

export function PersonControl({ field, value, onChange, shared }: ControlProps) {
    const person = asPerson(value);
    const emit = (patch: Partial<typeof person>) => onChange(nextPerson(person, patch));
    const designationId = subId(shared, "designation");

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SubField label="Name" htmlFor={shared.id}>
                <Input
                    {...controlAria(shared, shared.id, `${field.label}, name`)}
                    type="text"
                    autoComplete="off"
                    value={person.name}
                    onChange={(e) => emit({ name: e.target.value })}
                />
            </SubField>
            <SubField label="Designation" htmlFor={designationId}>
                <Input
                    {...controlAria(shared, designationId, `${field.label}, designation`)}
                    type="text"
                    autoComplete="off"
                    value={person.designation}
                    onChange={(e) => emit({ designation: e.target.value })}
                />
            </SubField>
        </div>
    );
}
