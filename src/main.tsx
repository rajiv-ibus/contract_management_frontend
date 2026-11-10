import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Toaster } from "sonner";

import { App } from "@/App";
import { DemoProvider } from "@/demo/store";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <DemoProvider>
                <App />
                <Toaster richColors position="top-right" />
            </DemoProvider>
        </BrowserRouter>
    </StrictMode>,
);
