/** A9·ui: one 32px control instead of a loud badge plus two toggles. */
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNetworks } from "@/features/network/use-networks";
import { type Network, setNetwork } from "@/lib/network";
import { cn } from "@/lib/utils";

const LABEL: Record<Network, string> = { testnet: "Testnet", mainnet: "Mainnet" };
const SHORT: Record<Network, string> = { testnet: "Test", mainnet: "Main" };

export function NetworkSelect() {
  const { network, networks } = useNetworks();
  const list: { network: Network; available: boolean; reason?: string }[] = networks.length
    ? networks.map((n) => ({
        network: n.network as Network,
        available: n.available,
        reason: n.reason,
      }))
    : [
        { network: "testnet", available: true },
        { network: "mainnet", available: false, reason: "Loading…" },
      ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Network"
          data-testid={network === "testnet" ? "testnet-badge" : undefined}
          className="text-muted-foreground"
        >
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              network === "testnet" ? "bg-warning" : "bg-success",
            )}
          />
          <span className="hidden sm:inline">{LABEL[network]}</span>
          <span className="sm:hidden">{SHORT[network]}</span>
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Network</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={network}
          onValueChange={(value) => {
            if (value === "testnet" || value === "mainnet") setNetwork(value);
          }}
        >
          {list.map((n) => (
            <DropdownMenuRadioItem key={n.network} value={n.network} disabled={!n.available}>
              <span className="flex flex-col">
                <span>{LABEL[n.network]}</span>
                {n.available ? null : (
                  <span className="text-xs font-normal text-muted-foreground">
                    {n.reason ?? "Not published yet"}
                  </span>
                )}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
