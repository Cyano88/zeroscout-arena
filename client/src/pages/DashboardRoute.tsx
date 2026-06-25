import { ZeroScoutPrivyProvider } from "../privy";
import { DashboardPage } from "./DashboardPage";

export default function DashboardRoute() {
  return (
    <ZeroScoutPrivyProvider>
      <DashboardPage />
    </ZeroScoutPrivyProvider>
  );
}
