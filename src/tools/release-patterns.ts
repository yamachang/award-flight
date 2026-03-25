import { z } from "zod";
import { apiRequest, throttledApiRequests } from "../api.js";
import { SOURCES, CABIN_CLASSES } from "../constants.js";
import { type AvailabilityItem } from "../format.js";

export const ReleasePatternSchema = z.object({
  origin: z
    .string()
    .describe(
      "Origin airport IATA code(s), comma-separated (e.g. JFK,EWR,ORD)"
    ),
  destination: z
    .string()
    .describe(
      "Destination airport IATA code(s), comma-separated (e.g. NRT,HND,TPE)"
    ),
  cabin: z
    .enum(CABIN_CLASSES)
    .describe("Cabin class to analyze (business, first, economy, premium)"),
  sources: z
    .array(z.enum(SOURCES))
    .optional()
    .describe(
      "Mileage programs to check. Defaults to major programs: united, aeroplan, virginatlantic, american, delta, alaska"
    ),
  days_ahead: z
    .number()
    .optional()
    .describe(
      "How many days ahead to scan (default 60). Larger range = more data but slower."
    ),
});

interface AirlineWindow {
  airline: string;
  source: string;
  earliestDate: string;
  latestDate: string;
  daysUntilEarliest: number;
  daysUntilLatest: number;
  totalFlights: number;
  routes: string[];
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86400000;
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / msPerDay
  );
}

export async function detectReleasePatterns(
  args: z.infer<typeof ReleasePatternSchema>
) {
  const today = new Date();
  const todayStr = toDateStr(today);
  const daysAhead = args.days_ahead ?? 60;
  const endDate = new Date(today.getTime() + daysAhead * 86400000);
  const endStr = toDateStr(endDate);

  const sources = args.sources ?? [
    "united",
    "aeroplan",
    "virginatlantic",
    "american",
    "delta",
    "alaska",
  ];

  // Query each source in parallel
  const requests = sources.map(
    (source) => () =>
      apiRequest("/search", {
        origin_airport: args.origin,
        destination_airport: args.destination,
        start_date: todayStr,
        end_date: endStr,
        cabin_class: args.cabin,
        source,
        take: "1000",
      }) as Promise<{ data?: AvailabilityItem[] }>
  );

  const results = await throttledApiRequests(requests);

  // Analyze: group by operating airline and find release windows
  const cabinKey = args.cabin === "business" ? "J" : args.cabin === "first" ? "F" : args.cabin === "economy" ? "Y" : "W";
  const availKey = `${cabinKey}Available` as keyof AvailabilityItem;
  const airlinesKey = `${cabinKey}DirectAirlines` as keyof AvailabilityItem;
  const airlinesKey2 = `${cabinKey}Airlines` as keyof AvailabilityItem;

  const airlineWindows = new Map<string, AirlineWindow>();

  for (let i = 0; i < sources.length; i++) {
    const res = results[i];
    if (res.status !== "fulfilled" || !res.value.data) continue;

    const source = sources[i];
    for (const item of res.value.data) {
      if (!item[availKey] || !item.Date) continue;

      const airlines = (
        (item[airlinesKey] as string) ||
        (item[airlinesKey2] as string) ||
        "unknown"
      ).split(",");

      for (const airline of airlines) {
        const trimmed = airline.trim();
        if (!trimmed) continue;
        const key = `${trimmed}|${source}`;
        const route = `${item.Route?.OriginAirport ?? "?"}→${item.Route?.DestinationAirport ?? "?"}`;
        const daysUntil = daysBetween(todayStr, item.Date);

        const existing = airlineWindows.get(key);
        if (!existing) {
          airlineWindows.set(key, {
            airline: trimmed,
            source,
            earliestDate: item.Date,
            latestDate: item.Date,
            daysUntilEarliest: daysUntil,
            daysUntilLatest: daysUntil,
            totalFlights: 1,
            routes: [route],
          });
        } else {
          existing.totalFlights++;
          if (item.Date < existing.earliestDate) {
            existing.earliestDate = item.Date;
            existing.daysUntilEarliest = daysUntil;
          }
          if (item.Date > existing.latestDate) {
            existing.latestDate = item.Date;
            existing.daysUntilLatest = daysUntil;
          }
          if (!existing.routes.includes(route)) {
            existing.routes.push(route);
          }
        }
      }
    }
  }

  // Format output
  const lines: string[] = [];
  lines.push(
    `=== Release Pattern Analysis ===`
  );
  lines.push(
    `Routes: ${args.origin} → ${args.destination} | Cabin: ${args.cabin}`
  );
  lines.push(`Scan range: ${todayStr} to ${endStr} (${daysAhead} days)`);
  lines.push(`Sources checked: ${sources.join(", ")}`);
  lines.push("");

  if (airlineWindows.size === 0) {
    lines.push(
      "No availability found. Either no seats released yet, or these routes have no award space in this period."
    );
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }

  // Group by airline for cleaner output
  const byAirline = new Map<string, AirlineWindow[]>();
  for (const w of airlineWindows.values()) {
    const arr = byAirline.get(w.airline) || [];
    arr.push(w);
    byAirline.set(w.airline, arr);
  }

  const airlineNames: Record<string, string> = {
    NH: "ANA (All Nippon Airways)",
    JL: "JAL (Japan Airlines)",
    BR: "EVA Air",
    JX: "Starlux",
    CI: "China Airlines",
    CX: "Cathay Pacific",
    SQ: "Singapore Airlines",
    TK: "Turkish Airlines",
    LH: "Lufthansa",
    LX: "Swiss",
    OS: "Austrian",
    AC: "Air Canada",
    OZ: "Asiana",
    KE: "Korean Air",
    TG: "Thai Airways",
    AI: "Air India",
    ET: "Ethiopian Airlines",
    EK: "Emirates",
    QR: "Qatar Airways",
    AF: "Air France",
    KL: "KLM",
    DL: "Delta",
    UA: "United",
    AA: "American",
    QF: "Qantas",
  };

  // Sort airlines alphabetically
  const sortedAirlines = [...byAirline.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [airline, windows] of sortedAirlines) {
    const name = airlineNames[airline] || airline;
    lines.push(`--- ${airline} (${name}) ---`);

    // Sort windows by days until earliest
    windows.sort((a, b) => a.daysUntilEarliest - b.daysUntilEarliest);

    for (const w of windows) {
      lines.push(`  via ${w.source}:`);
      lines.push(
        `    Earliest available: ${w.earliestDate} (${w.daysUntilEarliest} days from now)`
      );
      lines.push(
        `    Latest available:   ${w.latestDate} (${w.daysUntilLatest} days from now)`
      );
      lines.push(`    Total flights: ${w.totalFlights}`);
      lines.push(`    Routes: ${w.routes.join(", ")}`);

      // Infer release pattern
      if (w.daysUntilEarliest <= 14) {
        lines.push(
          `    ⟹ Release window: ~${w.daysUntilEarliest}-${Math.min(w.daysUntilLatest, daysAhead)} days before departure`
        );
      } else if (w.daysUntilEarliest <= 30) {
        lines.push(
          `    ⟹ Release window: ~${w.daysUntilEarliest}+ days before departure`
        );
      } else {
        lines.push(
          `    ⟹ Released far in advance (${w.daysUntilEarliest}+ days out) — likely standard award calendar`
        );
      }
    }
    lines.push("");
  }

  lines.push("=== How to interpret ===");
  lines.push(
    "• If airline X via source Y only has flights within the next 7-14 days,"
  );
  lines.push(
    "  it likely releases partner award space ~7-14 days before departure."
  );
  lines.push(
    "• If availability extends 30-60+ days out, seats are released on a standard schedule."
  );
  lines.push(
    "• Compare the same airline across different sources (e.g. NH via united vs virginatlantic)"
  );
  lines.push(
    "  to see if it releases to some partners earlier than others."
  );
  lines.push("");
  lines.push(
    "⚠ This is a point-in-time snapshot. For precise patterns, use collect_snapshot daily"
  );
  lines.push(
    "  for 2-4 weeks, then run analyze_release_patterns to find exact release timing."
  );

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}
