import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@auth-ninja/react";
import { readViteAuthClientConfig } from "@auth-ninja/react/vite";
import { App } from "./App";
import "./index.css";

const authConfig = readViteAuthClientConfig(import.meta.env);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider {...authConfig}>
      <App />
    </AuthProvider>
  </StrictMode>,
);
