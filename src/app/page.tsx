import { WorkspaceShell } from "@/components/WorkspaceShell";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { TimerProvider } from "@/context/TimerContext";

export default function Home() {
  return (
    <WorkspaceProvider>
      <TimerProvider>
        <WorkspaceShell />
      </TimerProvider>
    </WorkspaceProvider>
  );
}
