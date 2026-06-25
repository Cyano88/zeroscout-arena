import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

export const privyEnabled = Boolean(privyAppId);

export function ZeroScoutPrivyProvider({ children }: { children: ReactNode }) {
  if (!privyAppId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "wallet", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#7c3aed",
          logo: "/zeroscout-mark.png",
          landingHeader: "ZeroScout",
          loginMessage: "Team will never ask for this code.",
          walletChainType: "ethereum-only"
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets"
          }
        }
      }}
    >
      {children}
    </PrivyProvider>
  );
}
