/** Which remora's memory the inspector shows, kept in `?remora=` so every tab reads the same one. */
import { useSearchParams } from "react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RemoraSelect({ list, id }: { list: { id: string; name: string }[]; id: string }) {
  const [params, setParams] = useSearchParams();
  return (
    <Select
      value={id}
      onValueChange={(value) => {
        const next = new URLSearchParams(params);
        next.set("remora", value);
        setParams(next);
      }}
    >
      <SelectTrigger aria-label="Remora" className="w-48">
        <SelectValue placeholder="Remora" />
      </SelectTrigger>
      <SelectContent>
        {list.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
