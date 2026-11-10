import { Navigate, Route, Routes } from "react-router";

import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/pages/Dashboard";
import { ReportsPage } from "@/pages/ReportsPage";
import { InvitePage, ProjectsPage, TeamPage } from "@/pages/admin/AdminPages";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SetPasswordPage } from "@/pages/auth/AuthPages";
import { DocumentDetailPage } from "@/pages/documents/DocumentDetailPage";
import { DocumentFormPage } from "@/pages/documents/DocumentFormPage";
import { DocumentListPage } from "@/pages/documents/DocumentListPage";
import { ProjectMembersPage, ProjectSettingsPage } from "@/pages/project/ProjectPages";

export function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/set-password" element={<SetPasswordPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/documents" element={<DocumentListPage />} />
                <Route path="/documents/new" element={<DocumentFormPage />} />
                <Route path="/documents/:id" element={<DocumentDetailPage />} />
                <Route path="/documents/:id/edit" element={<DocumentFormPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/project/members" element={<ProjectMembersPage />} />
                <Route path="/project/settings" element={<ProjectSettingsPage />} />
                <Route path="/admin/team" element={<TeamPage />} />
                <Route path="/admin/invite" element={<InvitePage />} />
                <Route path="/admin/projects" element={<ProjectsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
