import { WorkspaceShell } from "@/components/WorkspaceShell";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { TimerProvider } from "@/context/TimerContext";
import { getCurrentUser } from "@/lib/auth";

export const instant = false;

export default async function Home() {
  const initialUser = await getCurrentUser();

  return (
    <WorkspaceProvider initialUser={initialUser}>
      <TimerProvider>
        <WorkspaceShell />
      </TimerProvider>
    </WorkspaceProvider>
  );
}

