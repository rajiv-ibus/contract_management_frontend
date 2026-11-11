import { ScaleIcon } from "lucide-react";
import { useMemo } from "react";

import { EmptyState } from "@/components/common";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { FieldLibrary, Rule, RuleTier } from "../model";
import { TIER_META, describeRule, ruleFieldKeys } from "./describe";
import { Chip, Mono, TierBadge } from "./shared";

const TIERS: RuleTier[] = ["BLOCK", "WARN", "FLAG"];

export function RulesTab({ library }: { library: FieldLibrary }) {
    const labels = useMemo(() => new Map(library.fields.map((f) => [f.key, f.label])), [library.fields]);
    const labelOf = (key: string) => labels.get(key) ?? key;

    const byTier = useMemo(() => {
        const groups: Record<RuleTier, Rule[]> = { BLOCK: [], WARN: [], FLAG: [] };
        for (const r of library.rules) groups[r.tier]?.push(r);
        return groups;
    }, [library.rules]);

    if (library.rules.length === 0) {
        return (
            <Card>
                <EmptyState
                    icon={ScaleIcon}
                    title="No cross-field rules"
                    text="Rules compare fields with each other. Add them to the library JSON."
                />
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {TIERS.map((tier) => (
                <section key={tier} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <TierBadge tier={tier} />
                        <h3 className="text-sm font-semibold">
                            {byTier[tier].length} {TIER_META[tier].label.toLowerCase()} rule
                            {byTier[tier].length === 1 ? "" : "s"}
                        </h3>
                        <p className="text-sm text-muted-foreground">{TIER_META[tier].effect}</p>
                    </div>
                    {byTier[tier].length === 0 ? (
                        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                            No rules at this tier.
                        </p>
                    ) : (
                        <ul className="grid gap-3 lg:grid-cols-2">
                            {byTier[tier].map((rule) => (
                                <li
                                    key={rule.id}
                                    className={cn("rounded-xl border bg-card p-4 shadow-xs", TIER_EDGE[tier])}
                                >
                                    <p className="text-sm font-medium">{rule.message}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{describeRule(rule, labelOf)}</p>
                                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                        {ruleFieldKeys(rule).map((key) => (
                                            <Chip key={key} className="gap-1.5">
                                                {labelOf(key)}
                                                <Mono>{key}</Mono>
                                            </Chip>
                                        ))}
                                        <Mono className="ml-auto">{rule.id}</Mono>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            ))}
        </div>
    );
}

const TIER_EDGE: Record<RuleTier, string> = {
    BLOCK: "border-l-4 border-l-destructive",
    WARN: "border-l-4 border-l-amber-400",
    FLAG: "border-l-4 border-l-sky-400",
};
