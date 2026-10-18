import { type CommandRow, type CommandTable, isOpenableUrl } from "@remora/core/command-table";
import { ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { isFlexibleId } from "@/components/fit-address";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Web3Address } from "@/components/web3-address";
import { messageActionClass } from "@/features/chat/message-action";

function actionLabel(cell: string | undefined): string {
  const trimmed = cell?.trim() ?? "";
  if (!trimmed || trimmed.length > 40) return "value";
  return trimmed;
}

function RowActions({ row }: { row: CommandRow }) {
  const href = row.href && isOpenableUrl(row.href) ? row.href : undefined;
  if (!row.copy && !href) return null;
  const label = actionLabel(row.cells[0]);
  return (
    <ButtonGroup>
      {row.copy ? (
        <CopyButton
          value={row.copy}
          label={label}
          variant="ghost"
          size="icon-sm"
          className={messageActionClass}
        />
      ) : null}
      {href ? (
        <Button size="icon-sm" variant="ghost" className={messageActionClass} asChild>
          <a href={href} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}>
            <ExternalLink />
          </a>
        </Button>
      ) : null}
    </ButtonGroup>
  );
}

export function CommandTableView({ table }: { table: CommandTable }) {
  const actions = table.rows.some((row) => row.copy || (row.href && isOpenableUrl(row.href)));
  return (
    <div className="flex w-full flex-col gap-3">
      {table.lead ? <p className="whitespace-pre-wrap text-sm">{table.lead}</p> : null}
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            {table.columns.map((column, index) => (
              <TableHead key={`${column}-${index}`}>{column}</TableHead>
            ))}
            {actions ? (
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row, index) => (
            <TableRow key={index}>
              {row.cells.map((cell, cellIndex) => (
                <TableCell key={cellIndex} className="overflow-hidden whitespace-pre-wrap">
                  {isFlexibleId(cell) ? <Web3Address value={cell} /> : cell}
                </TableCell>
              ))}
              {actions ? (
                <TableCell>
                  <RowActions row={row} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {table.foot ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{table.foot}</p>
      ) : null}
    </div>
  );
}
