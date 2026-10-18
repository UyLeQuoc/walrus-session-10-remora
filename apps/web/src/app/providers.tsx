import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
import "@mysten/dapp-kit/dist/index.css";
import { useEnokiWallets } from "@/app/use-enoki-wallets";

const { networkConfig } = createNetworkConfig({
  mainnet: { url: "https://fullnode.mainnet.sui.io:443", network: "mainnet" },
  testnet: { url: "https://fullnode.testnet.sui.io:443", network: "testnet" },
});

const queryClient = new QueryClient();

type CreateClient = NonNullable<ComponentProps<typeof SuiClientProvider>["createClient"]>;

function createClient(name: string, cfg: { url: string }): ReturnType<CreateClient> {
  const network = name === "testnet" ? "testnet" : "mainnet";
  const client = new SuiGrpcClient({ network, baseUrl: cfg.url });
  // dapp-kit still types this callback as a JSON-RPC client. Public fullnodes retired that transport.
  if (!("core" in client)) throw new Error("Sui client is missing the core API.");
  return client as unknown as ReturnType<CreateClient>;
}

function EnokiWallets(): null {
  useEnokiWallets();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networkConfig}
        defaultNetwork="mainnet"
        createClient={createClient}
      >
        {/* Reconnect-on-load opens Slush with no picker, and a rejected reconnect marks the wallet disconnected. */}
        <EnokiWallets />
        <WalletProvider autoConnect={false}>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
