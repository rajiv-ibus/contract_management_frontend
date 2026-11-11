import { ArrowLeft, CheckCircle2, Eye, EyeOff, MailCheck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
                <div className="flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 font-bold text-white">
                        iB
                    </div>
                    <span className="font-semibold text-white">iBUS Contract Management</span>
                </div>
                <div className="max-w-md">
                    <p className="text-2xl leading-snug font-semibold text-white">
                        Every contract checked by a second pair of eyes before it is used.
                    </p>
                    <ul className="mt-6 flex flex-col gap-3 text-sm">
                        {[
                            "Maker–checker approval for every contract",
                            "Every submitted version kept, never overwritten",
                            "Full history of who did what, and when",
                        ].map((t) => (
                            <li key={t} className="flex items-center gap-2">
                                <CheckCircle2 className="size-4 text-emerald-300" />
                                {t}
                            </li>
                        ))}
                    </ul>
                </div>
                <p className="text-xs text-sidebar-muted">Access is by invitation only.</p>
            </div>
            <div className="flex items-center justify-center p-6">
                <div className="w-full max-w-sm">
                    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                    {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
                    <div className="mt-8">{children}</div>
                </div>
            </div>
        </div>
    );
}

function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <Input
                id={id}
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pr-10"
            />
            <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={show ? "Hide password" : "Show password"}
            >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
        </div>
    );
}

function passwordProblems(password: string, confirm: string) {
    const problems: string[] = [];
    if (password.length < 8) problems.push("At least 8 characters");
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) problems.push("At least one letter and one number");
    if (confirm && password !== confirm) problems.push("Passwords do not match");
    return problems;
}

function PasswordRules({ password, confirm }: { password: string; confirm: string }) {
    const rules = [
        { text: "At least 8 characters", ok: password.length >= 8 },
        { text: "At least one letter and one number", ok: /[a-zA-Z]/.test(password) && /[0-9]/.test(password) },
        { text: "Both passwords match", ok: password.length > 0 && password === confirm },
    ];
    return (
        <ul className="flex flex-col gap-1 text-xs">
            {rules.map((r) => (
                <li key={r.text} className={r.ok ? "text-status-approved" : "text-muted-foreground"}>
                    {r.ok ? "✓" : "○"} {r.text}
                </li>
            ))}
        </ul>
    );
}

export function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("ravi.kumar@example.com");
    const [password, setPassword] = useState("demo1234");
    const [error, setError] = useState("");

    function submit(e: FormEvent) {
        e.preventDefault();
        if (!email || !password) {
            setError("Enter your email and password.");
            return;
        }
        navigate("/dashboard");
    }

    return (
        <AuthLayout title="Sign in" subtitle="Use the email address your invitation was sent to.">
            <form onSubmit={submit} className="flex flex-col gap-4">
                <Field label="Email" htmlFor="email">
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Password" htmlFor="password">
                    <PasswordInput id="password" value={password} onChange={setPassword} />
                </Field>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                        Forgot password?
                    </Link>
                </div>
                <Button type="submit" size="lg">
                    Sign in
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                    After 5 failed attempts the account is locked for 15 minutes.
                </p>
            </form>
        </AuthLayout>
    );
}

export function SetPasswordPage() {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [touched, setTouched] = useState(false);
    const problems = passwordProblems(password, confirm);

    function submit(e: FormEvent) {
        e.preventDefault();
        setTouched(true);
        if (problems.length === 0 && confirm) navigate("/login");
    }

    return (
        <AuthLayout
            title="Welcome, Meena"
            subtitle="You were invited to iBUS Contract Management. Set a password to activate your account."
        >
            <form onSubmit={submit} className="flex flex-col gap-4">
                <Field label="Email">
                    <Input value="meena.iyer@example.com" disabled />
                </Field>
                <Field label="New password" htmlFor="password">
                    <PasswordInput id="password" value={password} onChange={setPassword} />
                </Field>
                <Field label="Confirm password" htmlFor="confirm">
                    <PasswordInput id="confirm" value={confirm} onChange={setConfirm} />
                </Field>
                <PasswordRules password={password} confirm={confirm} />
                {touched && problems.length > 0 && <p className="text-sm text-destructive">{problems[0]}</p>}
                <Button type="submit" size="lg">
                    Activate account
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                    This link works once and expires in 48 hours.
                </p>
            </form>
        </AuthLayout>
    );
}

export function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);

    return (
        <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send you a reset link.">
            {sent ? (
                <div className="flex flex-col items-start gap-4">
                    <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
                        <MailCheck className="mt-0.5 size-5 text-primary" />
                        <p className="text-sm">
                            If an account exists for <span className="font-medium">{email}</span>, a reset link has been
                            sent. The link expires in 30 minutes.
                        </p>
                    </div>
                    <Link to="/reset-password" className="text-sm text-primary hover:underline">
                        Open the reset link (demo)
                    </Link>
                </div>
            ) : (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (email) setSent(true);
                    }}
                    className="flex flex-col gap-4"
                >
                    <Field label="Email" htmlFor="email">
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field>
                    <Button type="submit" size="lg">
                        Send reset link
                    </Button>
                </form>
            )}
            <Link
                to="/login"
                className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-4" /> Back to sign in
            </Link>
        </AuthLayout>
    );
}

export function ResetPasswordPage() {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [touched, setTouched] = useState(false);
    const problems = passwordProblems(password, confirm);

    return (
        <AuthLayout title="Choose a new password" subtitle="You'll be signed out of all other devices.">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setTouched(true);
                    if (problems.length === 0 && confirm) navigate("/login");
                }}
                className="flex flex-col gap-4"
            >
                <Field label="New password" htmlFor="password">
                    <PasswordInput id="password" value={password} onChange={setPassword} />
                </Field>
                <Field label="Confirm password" htmlFor="confirm">
                    <PasswordInput id="confirm" value={confirm} onChange={setConfirm} />
                </Field>
                <PasswordRules password={password} confirm={confirm} />
                {touched && problems.length > 0 && <p className="text-sm text-destructive">{problems[0]}</p>}
                <Button type="submit" size="lg">
                    Update password
                </Button>
            </form>
        </AuthLayout>
    );
}
