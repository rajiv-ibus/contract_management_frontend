# contract_management_frontend

Frontend for the iBUS Contract Management System.

**Current stage: UI prototype for customer approval.** Every screen works with in-memory sample data (`src/demo`), so the whole flow can be clicked through before the backend APIs are connected. The bar at the top switches the view between Super Admin, Project Admin, Maker and Checker.

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | 26.12.1 (see `.nvmrc`) |
| npm | 11.20.0 |

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and production build into dist/
```

## Screens

| Route | Screen | Role |
| --- | --- | --- |
| `/login`, `/set-password`, `/forgot-password`, `/reset-password` | Sign-in and password screens | Everyone |
| `/dashboard` | Status counts, items waiting for you, recent activity | Project members |
| `/documents` | Document list with status filters and search | Project members |
| `/documents/new`, `/documents/:id/edit` | Create or edit a draft: PDF upload and template-driven details | Maker |
| `/documents/:id` | Details, Notes, Versions, Activity; submit, approve, reject, invalidate, create from invalid | Maker, Checker |
| `/reports` | Approved and working reports | Project members |
| `/project/members` | Maker / Checker roles in the project | Project Admin |
| `/project/settings` | Categories, document types and JSON templates, distribution list | Project Admin |
| `/admin/team` | Users, project access and project Admins | Super Admin |
| `/admin/invite` | Invite a user | Super Admin |
| `/admin/projects` | Projects | Super Admin |

## Structure

```text
src/
  components/ui/       shared UI building blocks (Radix + Tailwind)
  components/          layout, status badges, template-driven metadata form
  demo/                sample data and the in-memory store used by the prototype
  pages/               one file per screen area
  styles/globals.css   theme tokens (colours, workflow status colours)
```

When the backend is connected, `src/demo/store.tsx` is replaced by API calls; the screens keep the same shape.
