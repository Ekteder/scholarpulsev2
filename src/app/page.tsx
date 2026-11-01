import { Suspense } from "react";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { TimerProvider } from "@/context/TimerContext";
import { getCurrentUser } from "@/lib/auth";

async function WorkspaceWithSession() {
  const initialUser = await getCurrentUser();

  return (
    <WorkspaceProvider initialUser={initialUser}>
      <TimerProvider>
        <WorkspaceShell />
      </TimerProvider>
    </WorkspaceProvider>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full space-y-4">
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mx-auto" />
            <div className="h-32 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
              <div className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      }
    >
      <WorkspaceWithSession />
    </Suspense>
  );
}

