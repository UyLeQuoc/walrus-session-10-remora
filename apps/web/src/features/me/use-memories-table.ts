import { useMemo, useState } from "react";
import type { Memory } from "@/features/me/memory";

export const MEMORY_PAGE_SIZE = 10;

export function memoriesOfType(memories: Memory[], type: string): Memory[] {
  if (type === "all") return memories;
  return memories.filter((memory) => memory.type === type);
}

export function showsMemoryPagination(count: number): boolean {
  return count > MEMORY_PAGE_SIZE;
}

export function useMemoriesTable(memories: Memory[]) {
  const [type, setTypeState] = useState("all");
  const [sorting, setSorting] = useState<Array<{ id: string; desc: boolean }>>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: MEMORY_PAGE_SIZE });
  const types = useMemo(
    () => [...new Set(memories.map((memory) => memory.type))].sort(),
    [memories],
  );
  const data = useMemo(() => memoriesOfType(memories, type), [memories, type]);

  const setType = (next: string) => {
    setTypeState(next);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  return {
    type,
    setType,
    types,
    sorting,
    setSorting,
    pagination,
    setPagination,
    data,
    paginated: showsMemoryPagination(data.length),
  };
}
