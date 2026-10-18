import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FIXTURE_MEMORY } from "@/features/remoras/fixtures";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

/** `/memory` (F3·ui skeleton on fixtures): every memory, hidden state, expiry and use count. */
export function MemoryInspectorPage() {
  useShellTitle("Memory");
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 overflow-auto p-4">
      <p className="text-sm text-muted-foreground">
        Sample rows. Each is a Walrus blob in your own Walrus Memory account; expiry is when the
        storage period ends.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Memory</TableHead>
            <TableHead>Namespace</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Used in</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {FIXTURE_MEMORY.map((m) => (
            <TableRow key={m.blobId}>
              <TableCell className="max-w-72 truncate">
                {m.text ?? <code className="text-xs">{m.blobId}</code>}
              </TableCell>
              <TableCell>{m.namespace}</TableCell>
              <TableCell>
                <Badge variant={m.status === "stored" ? "secondary" : "outline"}>
                  {m.hidden ? "hidden" : m.status}
                </Badge>
              </TableCell>
              <TableCell>{day(m.expiresAt)}</TableCell>
              <TableCell className="text-right">{m.usedIn}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
