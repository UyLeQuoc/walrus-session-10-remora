/**
 * U19 C4 (ADR-0141): x402's Bazaar discovery extension (`extensions.bazaar` in a 402), so an indexer
 * or an agent can call a paid door without guessing its input. The shape follows the x402 spec's
 * `specs/extensions/bazaar.md`: `info` (an example input and output) and `schema` (JSON Schema
 * 2020-12 that validates `info`), plus `routeTemplate` for a door with path parameters.
 */

export interface DiscoveryParam {
  example: string;
  description: string;
  required?: boolean;
}

export interface DoorDiscovery {
  /** `:param` syntax, for a door with path parameters; their order is `path`'s. */
  routeTemplate?: string;
  path?: Record<string, DiscoveryParam>;
  query?: Record<string, DiscoveryParam>;
  output?: { example: Record<string, unknown> };
}

export interface BazaarExtension {
  info: {
    input: {
      type: "http";
      method: "GET";
      queryParams?: Record<string, string>;
      pathParams?: Record<string, string>;
    };
    output?: { type: "json"; example: Record<string, unknown> };
  };
  schema: Record<string, unknown>;
  routeTemplate?: string;
}

const examples = (params: Record<string, DiscoveryParam>) =>
  Object.fromEntries(Object.entries(params).map(([k, p]) => [k, p.example]));

const paramsSchema = (params: Record<string, DiscoveryParam>) => {
  const required = Object.entries(params).flatMap(([k, p]) => (p.required === false ? [] : [k]));
  return {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(params).map(([k, p]) => [k, { type: "string", description: p.description }]),
    ),
    ...(required.length ? { required } : {}),
  };
};

export function bazaarExtension(d: DoorDiscovery = {}): BazaarExtension {
  return {
    info: {
      input: {
        type: "http",
        method: "GET",
        ...(d.query ? { queryParams: examples(d.query) } : {}),
        ...(d.path ? { pathParams: examples(d.path) } : {}),
      },
      ...(d.output ? { output: { type: "json" as const, example: d.output.example } } : {}),
    },
    schema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        input: {
          type: "object",
          properties: {
            type: { type: "string", const: "http" },
            method: { type: "string", enum: ["GET"] },
            ...(d.query ? { queryParams: paramsSchema(d.query) } : {}),
            ...(d.path ? { pathParams: paramsSchema(d.path) } : {}),
          },
          required: ["type", "method"],
          additionalProperties: false,
        },
        output: {
          type: "object",
          properties: { type: { type: "string" }, example: { type: "object" } },
          required: ["type"],
        },
      },
      required: ["input"],
    },
    ...(d.routeTemplate ? { routeTemplate: d.routeTemplate } : {}),
  };
}

/** A listed URL with its `:param` segments filled from the declaration's path examples, in order. */
export function exampleUrl(url: string, d: DoorDiscovery = {}): string {
  const values = Object.values(d.path ?? {}).map((p) => encodeURIComponent(p.example));
  let i = 0;
  return url.replace(/\/:[A-Za-z_][A-Za-z0-9_]*/g, (segment) => {
    const v = values[i++];
    return v === undefined ? segment : `/${v}`;
  });
}

/**
 * The eight house doors (`apps/merchants`), by Reef slug: what each 402 says it sells, and its
 * discovery. The merchants' 402s and the facilitator's catalog both read this, so they agree.
 */
export interface HouseDoor {
  description: string;
  discovery: DoorDiscovery;
}

export const HOUSE_DOORS = {
  "sui-risk": {
    description: "Sui object risk report",
    discovery: {
      routeTemplate: "/sui-risk/:id",
      path: { id: { example: "0x2", description: "A Sui object or package id." } },
      output: {
        example: {
          report: {
            id: "0x2",
            network: "testnet",
            type: "package",
            ageDays: null,
            upgradeCap: null,
            systemPackage: true,
            flags: ["system package"],
          },
        },
      },
    },
  },
  odds: {
    description: "Cached sports-odds snapshot",
    discovery: {
      query: {
        q: {
          example: "Arsenal",
          description: "A team to look for; every fixture when none matches.",
          required: false,
        },
      },
      output: {
        example: {
          takenAt: "2026-11-05T18:50:00.000Z",
          fixtures: [
            {
              league: "Premier League",
              home: "Arsenal",
              away: "Chelsea",
              kickoff: "2026-11-05T19:00:00.000Z",
              odds: { home: 1.95, draw: 3.6, away: 3.9 },
            },
          ],
        },
      },
    },
  },
  brief: {
    description: "Short summary",
    discovery: {
      query: {
        url: { example: "https://docs.wal.app", description: "An http(s) page to summarize." },
      },
      output: { example: { summary: "- Walrus stores blobs…", source: "https://docs.wal.app" } },
    },
  },
  wallet: {
    description: "Sui wallet X-ray",
    discovery: {
      routeTemplate: "/wallet/:address",
      path: { address: { example: "0x5", description: "A Sui address." } },
      output: {
        example: {
          source: "Sui gRPC",
          network: "testnet",
          address: "0x5",
          coins: [{ symbol: "SUI", amount: "1.5", coinType: "0x2::sui::SUI" }],
          objects: { count: 3, more: false, kinds: [{ kind: "0x2::coin::Coin", count: 3 }] },
        },
      },
    },
  },
  walrus: {
    description: "Walrus blob check",
    discovery: {
      routeTemplate: "/walrus/:blobId",
      path: {
        blobId: {
          example: "e56gG822FN23RWs9FC0N5HAycNka0YKSO3pcAjDgkTc",
          description: "A Walrus blob id (43 characters).",
        },
      },
      output: {
        example: {
          source: "Walrus aggregator",
          walrus: "testnet",
          readable: true,
          bytes: 2048,
          kind: "json",
          firstLine: "{",
        },
      },
    },
  },
  github: {
    description: "GitHub repo health",
    discovery: {
      routeTemplate: "/github/:owner/:repo",
      path: {
        owner: { example: "MystenLabs", description: "The repo's owner." },
        repo: { example: "sui", description: "The repo's name." },
      },
      output: {
        example: {
          source: "GitHub",
          repo: "MystenLabs/sui",
          stars: 7000,
          openIssues: 1200,
          license: "Apache-2.0",
          archived: false,
          daysSincePush: 0,
          flags: [],
        },
      },
    },
  },
  price: {
    description: "Token prices",
    discovery: {
      query: {
        symbols: {
          example: "SUI,WAL",
          description: "Any of SUI, WAL, BTC, ETH; all four when none is named.",
          required: false,
        },
      },
      output: {
        example: {
          source: "CoinGecko",
          prices: [{ symbol: "SUI", name: "Sui", usd: 3.1, pricedAt: "2026-11-05T09:00:00.000Z" }],
        },
      },
    },
  },
  weather: {
    description: "Three-day forecast",
    discovery: {
      query: { city: { example: "Lisbon", description: "A city name, up to 80 characters." } },
      output: {
        example: {
          source: "Open-Meteo",
          place: "Lisbon, Portugal",
          days: [{ date: "2026-11-06", sky: "rain", minC: 13, maxC: 18, rainChance: 70 }],
        },
      },
    },
  },
} satisfies Record<string, HouseDoor>;

export type HouseSlug = keyof typeof HOUSE_DOORS;

export const houseDoor = (slug: string): HouseDoor | undefined =>
  Object.hasOwn(HOUSE_DOORS, slug) ? HOUSE_DOORS[slug as HouseSlug] : undefined;
