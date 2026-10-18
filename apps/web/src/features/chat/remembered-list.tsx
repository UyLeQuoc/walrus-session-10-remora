import { Eye, EyeOff, NotebookPen, Pencil } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { canCorrect, type RememberedCard, writeLabel } from "@/features/chat/remembered";

export function RememberedList({
  cards,
  now,
  loading,
  error,
  onHide,
  onCorrect,
}: {
  cards: RememberedCard[];
  now: number;
  loading: boolean;
  error: string;
  onHide: (card: RememberedCard) => void;
  onCorrect: (card: RememberedCard) => void;
}) {
  if (loading && cards.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-4" role="status" aria-label="Loading memories">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (cards.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
        <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-brand/15 text-brand [&_svg]:size-5">
          <NotebookPen aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">Nothing remembered in this chat yet.</p>
        <p className="text-sm text-muted-foreground">Facts hippo keeps land here.</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scroll-fade-y px-4">
      {cards.map((card) => (
        <RememberedCardView
          key={card.key}
          card={card}
          now={now}
          onHide={onHide}
          onCorrect={onCorrect}
        />
      ))}
    </div>
  );
}

function RememberedCardView({
  card,
  now,
  onHide,
  onCorrect,
}: {
  card: RememberedCard;
  now: number;
  onHide: (card: RememberedCard) => void;
  onCorrect: (card: RememberedCard) => void;
}) {
  const label = writeLabel({
    saved: card.saved,
    status: card.status,
    startedAt: card.startedAt,
    now,
    hidden: card.hidden,
  });
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>Just remembered</CardTitle>
        <div className="flex gap-2">
          <Badge variant="outline">{card.type}</Badge>
          <Badge
            variant="secondary"
            className={card.status === "stored" ? "bg-brand/15 text-brand" : undefined}
          >
            {label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        <p>{card.text}</p>
        {card.hidden ? (
          <p>Hidden. It is still on Walrus. Nothing there can be deleted yet.</p>
        ) : null}
        {card.error ? <p>{card.error}</p> : null}
      </CardContent>
      <CardFooter className="gap-2 px-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/me">
            <Eye />
            View
          </Link>
        </Button>
        {canCorrect(card) ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onCorrect(card)}>
            <Pencil />
            Correct
          </Button>
        ) : null}
        {card.blobId && !card.hidden ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onHide(card)}>
            <EyeOff />
            Hide
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
