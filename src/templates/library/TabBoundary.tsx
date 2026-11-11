import { TriangleAlertIcon } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface TabBoundaryProps {
    /** The failure clears itself when this changes, for example when a new library version arrives. */
    resetKey: unknown;
    children: ReactNode;
}

interface TabBoundaryState {
    error: Error | null;
    resetKey: unknown;
}

/**
 * Keeps one library screen failing from taking the whole page down. The library is configuration an Admin pastes,
 * so a definition the screens cannot draw is shown as a message here instead of a blank page.
 */
export class TabBoundary extends Component<TabBoundaryProps, TabBoundaryState> {
    state: TabBoundaryState = { error: null, resetKey: this.props.resetKey };

    static getDerivedStateFromError(error: Error): Partial<TabBoundaryState> {
        return { error };
    }

    static getDerivedStateFromProps(
        props: TabBoundaryProps,
        state: TabBoundaryState,
    ): Partial<TabBoundaryState> | null {
        return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Field library screen failed to render", error, info.componentStack);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        return (
            <Card role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <div className="rounded-full bg-destructive/10 p-3">
                    <TriangleAlertIcon className="size-5 text-destructive" />
                </div>
                <p className="text-sm font-medium">This tab could not be shown</p>
                <p className="max-w-md text-sm text-muted-foreground">
                    The library holds a definition this screen cannot display. Correct it in the Edit JSON tab and check
                    it again.
                </p>
                <code className="max-w-full font-mono text-xs break-words text-muted-foreground">{error.message}</code>
                <Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>
                    Try again
                </Button>
            </Card>
        );
    }
}
