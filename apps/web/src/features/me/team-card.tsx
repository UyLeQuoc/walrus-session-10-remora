import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { membersLabel, sharedCounts } from "@/hooks/team-counts";
import { useTeam } from "@/hooks/use-team";

export function TeamCard() {
  const { team, error } = useTeam();

  if (team === undefined) {
    return error ? (
      <Card>
        <CardHeader>
          <CardTitle>Team memory</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    ) : null;
  }

  if (team === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team memory</CardTitle>
          <CardDescription>
            You are not in a team. In one, your own memory stays yours: only what you add is shared.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/team">Start or join a team</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="min-w-0 wrap-anywhere">Team: {team.name}</CardTitle>
        <CardDescription>
          {membersLabel(team.memberCount)} · {sharedCounts(team.memories).shared} shared. Team
          memory is not part of yours: it lives in hippo's account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" asChild>
          <Link to="/team">Open team</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
