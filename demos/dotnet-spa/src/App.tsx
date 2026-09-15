import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DemoAuthProvider } from "./components/DemoAuthProvider";
import { DemoShell } from "./components/DemoShell";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { PasskeysPage } from "./pages/PasskeysPage";
import { RegisterPage } from "./pages/RegisterPage";
import { TwoFaPage } from "./pages/TwoFaPage";
import { TwoFaVerifyPage } from "./pages/TwoFaVerifyPage";

export function App() {
  return (
    <BrowserRouter>
      <DemoAuthProvider>
        <Routes>
          <Route element={<DemoShell />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="2fa" element={<TwoFaPage />} />
            <Route path="2fa/verify" element={<TwoFaVerifyPage />} />
            <Route path="passkeys" element={<PasskeysPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </DemoAuthProvider>
    </BrowserRouter>
  );
}
