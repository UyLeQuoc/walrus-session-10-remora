/**
 * B5: the footer is an account menu, not a link plus a channel card. Signed in it holds the
 * address, Settings, Theme, Verify, the guide, the chat channels and Sign out; signed out it is a
 * Sign in button plus a small menu that still reaches everything.
 */
import {
  ArrowUpRight,
  Eye,
  Info,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { WalletAvatar } from "@/app/wallet-avatar";
import { readShowBalance, writeShowBalance } from "@/components/app/show-balance";
import { ThemeChoice } from "@/components/app/theme-choice";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { WalletPicker } from "@/components/wallet-picker";
import { Web3Address } from "@/components/web3-address";
import { useWalletResume } from "@/features/connect/wallet-resume";
import { useWalletBalance } from "@/features/funds/use-wallet-balance";
import { useMe } from "@/features/me/use-me";
import { formatSui } from "@/lib/balance";
import { DISCORD_BOT, TELEGRAM_BOT } from "@/lib/channels";
import { formatUsdc } from "@/lib/usdc";

function ChannelItems() {
  return (
    <>
      <DropdownMenuItem asChild>
        <a href={TELEGRAM_BOT.url} target="_blank" rel="noreferrer">
          <Send /> Open in Telegram <ArrowUpRight className="ml-auto" />
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <a href={DISCORD_BOT.url} target="_blank" rel="noreferrer">
          <MessagesSquare /> Add to Discord <ArrowUpRight className="ml-auto" />
        </a>
      </DropdownMenuItem>
    </>
  );
}

export function AccountMenu() {
  const { me, load, signOut } = useMe();
  const resume = useWalletResume();
  const [reconnect, setReconnect] = useState(false);
  const [showBalance, setShowBalance] = useState(readShowBalance);
  const address = me?.walletAddress ?? null;
  const balance = useWalletBalance(address);
  const loadingBalance = balance.loading && balance.sui === null;
  const balanceText = balance.failed
    ? "—"
    : loadingBalance
      ? "…"
      : `${formatSui(balance.sui ?? 0n)} SUI · ${formatUsdc(balance.usdc ?? 0n)} USDC`;
  // The sidebar row is narrow: only USDC (what remoras spend); the menu shows SUI too.
  const sidebarBalance =
    balance.failed || loadingBalance ? balanceText : `${formatUsdc(balance.usdc ?? 0n)} USDC`;

  if (!address) {
    return (
      <div className="flex w-full items-center gap-1">
        <WalletPicker
          className="flex-1"
          variant="outline"
          label="Sign in"
          signIn
          onSignedIn={load}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="More"
              className="text-muted-foreground"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <ThemeChoice />
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/guide">
                <Info /> How Remora works
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ChannelItems />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  const disconnected = resume.needsReconnect;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-2 py-1.5"
          >
            <span className="relative shrink-0">
              <WalletAvatar address={address} />
              {disconnected ? (
                <span
                  aria-hidden
                  className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-warning ring-2 ring-sidebar"
                />
              ) : null}
            </span>
            <span className="min-w-0 flex-1 text-left text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              <span className="block truncate">
                <Web3Address value={address} />
              </span>
              {showBalance ? (
                <span
                  data-testid="sidebar-balance"
                  className="block truncate font-sans tabular-nums"
                >
                  {sidebarBalance}
                </span>
              ) : null}
            </span>
            {disconnected ? <span className="sr-only">Wallet not connected</span> : null}
            <MoreHorizontal className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-64">
          <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate" title={address}>
                <Web3Address value={address} className="text-xs" />
              </span>
              <CopyButton value={address} label="address" variant="ghost" size="icon-sm" />
            </span>
            {showBalance ? (
              <span data-testid="wallet-balance" className="text-xs text-muted-foreground">
                {balance.failed ? (
                  "—"
                ) : loadingBalance ? (
                  <Skeleton className="h-3 w-28" />
                ) : (
                  `${formatSui(balance.sui ?? 0n)} SUI · ${formatUsdc(balance.usdc ?? 0n)} USDC`
                )}
              </span>
            ) : null}
          </DropdownMenuLabel>
          {disconnected ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setReconnect(true)}>
                <RefreshCw /> Reconnect wallet
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              // Keep the menu open so the switch visibly flips.
              event.preventDefault();
              setShowBalance(!showBalance);
              writeShowBalance(!showBalance);
            }}
          >
            <Eye /> Show balance
            <Switch
              size="sm"
              checked={showBalance}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none ml-auto"
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Settings /> Settings
            </Link>
          </DropdownMenuItem>
          <ThemeChoice />
          <DropdownMenuItem asChild>
            <Link to="/verify">
              <ShieldCheck /> Verify a receipt
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/guide">
              <Info /> How Remora works
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <ChannelItems />
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WalletPicker
        label=""
        hideTrigger
        open={reconnect}
        onOpenChange={setReconnect}
        onSignedIn={load}
      />
    </>
  );
}

/** Kept for the collapsed sidebar's tooltip. */
export const ACCOUNT_ICON = Wallet;
