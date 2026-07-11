import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import LandingPage from "@/pages/LandingPage";
import ViewerPage from "@/pages/ViewerPage";
import AdminLogin from "@/pages/AdminLogin";
import AdminPage from "@/pages/AdminPage";
import { useAdminToken, adminWhoami } from "@/lib/api";

function AdminRoute() {
  const { token, role, permissions, save, clear } = useAdminToken();

  // 🔁 نتأكد كل فترة من صلاحية الجلسة عند الخادم: لو الأدمن حذف هذا المساعد
  // نطلعه فوراً من صفحة الأدمن (بدل ما يضل شغال بجلسة محذوفة)، ولو الأدمن
  // غيّر صلاحياته (فعّل/عطّل شي) نحدّثها عنده مباشرة بدون ما يحتاج يعمل
  // تسجيل خروج ودخول من جديد.
  const clearRef = useRef(clear);
  clearRef.current = clear;
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const check = async () => {
      const result = await adminWhoami(token);
      if (cancelled) return;
      if (!result) {
        // التوكن ما عاد صالح — يعني الأدمن حذف هذا المساعد
        clearRef.current();
        return;
      }
      if (
        result.role !== role ||
        JSON.stringify(result.permissions || {}) !== JSON.stringify(permissions || {})
      ) {
        saveRef.current({ token, role: result.role, permissions: result.permissions || {} });
      }
    };
    const id = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, role, permissions]);

  if (!token) return <AdminLogin onLogin={save} />;
  return <AdminPage token={token} role={role} permissions={permissions} onLogout={clear} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/admin" component={AdminRoute} />
      <Route path="/live" component={ViewerPage} />
      <Route component={LandingPage} />
    </Switch>
  );
}

export default function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}