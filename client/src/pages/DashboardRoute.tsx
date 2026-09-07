import PrivateKeysPage from "./PrivateKeysPage";
import PrivateWalletConnection from "./PrivateWalletConnection";
import { ZeroScoutPrivyProvider, privyEnabled } from "../privy";

export default function DashboardRoute() {
  return privyEnabled ? <ZeroScoutPrivyProvider><PrivateWalletConnection /></ZeroScoutPrivyProvider> : <PrivateKeysPage />;
}
