// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import AppLayout from "./components/AppLayout";
import { LoginScreen } from "./components/LoginScreen";
import { useProjectStore } from "./store/projectStore";
import { useNavigationStore } from "./store/navigationStore";
import { useSessionStore } from "./store/sessionStore";

function App() {
  const { loadRecentProjects } = useProjectStore();
  const { setView } = useNavigationStore();
  const { status, restoreSession } = useSessionStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Initialize app once a real session exists
  useEffect(() => {
    if (status === "authenticated") {
      loadRecentProjects();
      setView("welcome");
    }
  }, [status, loadRecentProjects, setView]);

  if (status === "checking") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return <LoginScreen />;
  }

  return <AppLayout />;
}

export default App;
