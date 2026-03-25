import { z } from "zod";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { apiRequest, throttledApiRequests } from "../api.js";
import { SOURCES, CABIN_CLASSES } from "../constants.js";
import { type AvailabilityItem } from "../format.js";

// Snapshot storage directory — stored alongside the project
const DATA_DIR = join(import.meta.dirname, "../../data/snapshots");

export interface SnapshotEntry {
  date: string; // departure date
  source: string; // mileage program
  origin: string;
  destination: string;
  airline: string; // operating airline code
  cabin: string;
  mileageCost: string | null;
  seats: number | null;
}

export interface Snapshot {
  captured_at: string; // ISO timestamp of when snapshot was taken
  query: {
    origin: string;
    destination: string;
    cabin: string;
    scan_start: string;
    scan_end: string;
    sources: string[];
  };
  entries: SnapshotEntry[];
}

// --- Tool 1: Collect Snapshot ---

export const CollectSnapshotSchema = z.object({
  origin: z
    .string()
    .describe("Origin airport IATA code(s), comma-separated"),
  destination: z
    .string()
    .describe("Destination airport IATA code(s), comma-separated"),
  cabin: z.enum(CABIN_CLASSES).describe("Cabin class to track"),
  sources: z
    .array(z.enum(SOURCES))
    .optional()
    .describe(
      "Mileage programs to snapshot. Defaults to: united, aeroplan, virginatlantic, american, delta, alaska"
    ),
  days_ahead: z
    .number()
    .optional()
    .describe("How many days ahead to scan (default 60)"),
});

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function extractEntries(
  items: AvailabilityItem[],
  source: string,
  cabin: string
): SnapshotEntry[] {
  const cabinKey =
    cabin === "business"
      ? "J"
      : cabin === "first"
        ? "F"
        : cabin === "economy"
          ? "Y"
          : "W";
  const availKey = `${cabinKey}Available` as keyof AvailabilityItem;
  const airlinesKey = `${cabinKey}DirectAirlines` as keyof AvailabilityItem;
  const airlinesKey2 = `${cabinKey}Airlines` as keyof AvailabilityItem;
  const costKey = `${cabinKey}DirectMileageCost` as keyof AvailabilityItem;
  const costKey2 = `${cabinKey}MileageCost` as keyof AvailabilityItem;
  const seatsKey = `${cabinKey}RemainingSeats` as keyof AvailabilityItem;

  const entries: SnapshotEntry[] = [];

  for (const item of items) {
    if (!item[availKey] || !item.Date) continue;

    const airlines = (
      (item[airlinesKey] as string) ||
      (item[airlinesKey2] as string) ||
      "unknown"
    )
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    for (const airline of airlines) {
      entries.push({
        date: item.Date,
        source,
        origin: item.Route?.OriginAirport ?? "?",
        destination: item.Route?.DestinationAirport ?? "?",
        airline,
        cabin,
        mileageCost:
          (item[costKey] as string) || (item[costKey2] as string) || null,
        seats: (item[seatsKey] as number) ?? null,
      });
    }
  }

  return entries;
}

export async function collectSnapshot(
  args: z.infer<typeof CollectSnapshotSchema>
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

  // Query each source
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

  // Extract entries
  const allEntries: SnapshotEntry[] = [];
  for (let i = 0; i < sources.length; i++) {
    const res = results[i];
    if (res.status === "fulfilled" && res.value.data) {
      allEntries.push(
        ...extractEntries(res.value.data, sources[i], args.cabin)
      );
    }
  }

  const snapshot: Snapshot = {
    captured_at: today.toISOString(),
    query: {
      origin: args.origin,
      destination: args.destination,
      cabin: args.cabin,
      scan_start: todayStr,
      scan_end: endStr,
      sources,
    },
    entries: allEntries,
  };

  // Save snapshot
  await mkdir(DATA_DIR, { recursive: true });
  const filename = `${todayStr}_${args.origin}_${args.destination}_${args.cabin}.json`;
  const filepath = join(DATA_DIR, filename);
  await writeFile(filepath, JSON.stringify(snapshot, null, 2));

  // Summary
  const byAirline = new Map<string, number>();
  for (const e of allEntries) {
    byAirline.set(e.airline, (byAirline.get(e.airline) || 0) + 1);
  }

  const lines: string[] = [];
  lines.push(`Snapshot collected: ${filename}`);
  lines.push(`Captured at: ${snapshot.captured_at}`);
  lines.push(
    `Routes: ${args.origin} → ${args.destination} | Cabin: ${args.cabin}`
  );
  lines.push(`Date range: ${todayStr} to ${endStr}`);
  lines.push(`Total entries: ${allEntries.length}`);
  lines.push("");
  lines.push("Airlines found:");
  for (const [airline, count] of [...byAirline.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    lines.push(`  ${airline}: ${count} flights`);
  }
  lines.push("");
  lines.push(
    `Run this daily for 2-4 weeks, then use analyze_release_patterns to find precise release timing.`
  );

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

// --- Tool 2: Analyze Release Patterns from Snapshots ---

export const AnalyzePatternsSchema = z.object({
  origin: z
    .string()
    .optional()
    .describe("Filter by origin airport(s). If omitted, analyzes all."),
  destination: z
    .string()
    .optional()
    .describe("Filter by destination airport(s). If omitted, analyzes all."),
  cabin: z
    .enum(CABIN_CLASSES)
    .optional()
    .describe("Filter by cabin class. If omitted, analyzes all."),
  airline: z
    .string()
    .optional()
    .describe(
      "Filter by operating airline code (e.g. NH for ANA). If omitted, analyzes all."
    ),
});

interface FirstSeen {
  departureDate: string;
  airline: string;
  source: string;
  origin: string;
  destination: string;
  cabin: string;
  firstSeenDate: string; // date of snapshot when first seen
  daysBeforeDeparture: number;
}

export async function analyzeReleasePatterns(
  args: z.infer<typeof AnalyzePatternsSchema>
) {
  // Load all snapshots
  let files: string[];
  try {
    files = await readdir(DATA_DIR);
  } catch {
    return {
      content: [
        {
          type: "text" as const,
          text: "No snapshots found. Run collect_snapshot daily for 2-4 weeks first to build up data.",
        },
      ],
    };
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  if (jsonFiles.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "No snapshots found. Run collect_snapshot daily first.",
        },
      ],
    };
  }

  // Load and merge all snapshots
  // Key: "departureDate|airline|source|origin|dest|cabin" → earliest snapshot date
  const firstSeenMap = new Map<string, FirstSeen>();

  for (const file of jsonFiles) {
    const raw = await readFile(join(DATA_DIR, file), "utf-8");
    const snapshot: Snapshot = JSON.parse(raw);
    const capturedDate = snapshot.captured_at.slice(0, 10);

    for (const entry of snapshot.entries) {
      // Apply filters
      if (args.cabin && entry.cabin !== args.cabin) continue;
      if (args.airline && entry.airline !== args.airline) continue;
      if (args.origin) {
        const origins = args.origin.split(",").map((s) => s.trim());
        if (!origins.includes(entry.origin)) continue;
      }
      if (args.destination) {
        const dests = args.destination.split(",").map((s) => s.trim());
        if (!dests.includes(entry.destination)) continue;
      }

      const key = `${entry.date}|${entry.airline}|${entry.source}|${entry.origin}|${entry.destination}|${entry.cabin}`;

      if (!firstSeenMap.has(key)) {
        const daysBeforeDep = daysBetween(capturedDate, entry.date);
        firstSeenMap.set(key, {
          departureDate: entry.date,
          airline: entry.airline,
          source: entry.source,
          origin: entry.origin,
          destination: entry.destination,
          cabin: entry.cabin,
          firstSeenDate: capturedDate,
          daysBeforeDeparture: daysBeforeDep,
        });
      }
    }
  }

  if (firstSeenMap.size === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "No matching entries found in snapshots. Check your filters or collect more data.",
        },
      ],
    };
  }

  // Group by airline+source and compute statistics
  interface PatternStats {
    airline: string;
    source: string;
    cabin: string;
    routes: Set<string>;
    daysBeforeDeparture: number[];
    sampleDates: string[];
  }

  const patterns = new Map<string, PatternStats>();

  for (const fs of firstSeenMap.values()) {
    const key = `${fs.airline}|${fs.source}|${fs.cabin}`;
    if (!patterns.has(key)) {
      patterns.set(key, {
        airline: fs.airline,
        source: fs.source,
        cabin: fs.cabin,
        routes: new Set(),
        daysBeforeDeparture: [],
        sampleDates: [],
      });
    }
    const p = patterns.get(key)!;
    p.routes.add(`${fs.origin}→${fs.destination}`);
    p.daysBeforeDeparture.push(fs.daysBeforeDeparture);
    if (p.sampleDates.length < 5) {
      p.sampleDates.push(
        `${fs.departureDate} (first seen ${fs.firstSeenDate}, ${fs.daysBeforeDeparture}d before)`
      );
    }
  }

  // Format output
  const lines: string[] = [];
  lines.push("=== Release Pattern Analysis (from snapshots) ===");
  lines.push(`Snapshots analyzed: ${jsonFiles.length} files`);
  lines.push(
    `Date range: ${jsonFiles[0].slice(0, 10)} to ${jsonFiles[jsonFiles.length - 1].slice(0, 10)}`
  );
  lines.push("");

  const airlineNames: Record<string, string> = {
    NH: "ANA",
    JL: "JAL",
    BR: "EVA Air",
    JX: "Starlux",
    CI: "China Airlines",
    CX: "Cathay Pacific",
    SQ: "Singapore Airlines",
    TK: "Turkish Airlines",
    LH: "Lufthansa",
    EK: "Emirates",
    QR: "Qatar Airways",
    KE: "Korean Air",
    OZ: "Asiana",
    TG: "Thai Airways",
  };

  // Sort by airline
  const sorted = [...patterns.values()].sort((a, b) => {
    if (a.airline !== b.airline) return a.airline.localeCompare(b.airline);
    return a.source.localeCompare(b.source);
  });

  let currentAirline = "";
  for (const p of sorted) {
    if (p.airline !== currentAirline) {
      currentAirline = p.airline;
      const name = airlineNames[p.airline] || p.airline;
      lines.push(`--- ${p.airline} (${name}) ---`);
    }

    const days = p.daysBeforeDeparture.sort((a, b) => a - b);
    const min = days[0];
    const max = days[days.length - 1];
    const median = days[Math.floor(days.length / 2)];
    const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    const mode = findMode(days);

    lines.push(`  via ${p.source} (${p.cabin}):`);
    lines.push(`    Routes: ${[...p.routes].join(", ")}`);
    lines.push(`    Data points: ${days.length}`);
    lines.push(`    Days before departure when first seen:`);
    lines.push(`      Min: ${min} | Max: ${max} | Median: ${median} | Avg: ${avg} | Mode: ${mode}`);
    lines.push(`    ⟹ Likely release window: ~${mode}-${max} days before departure`);
    lines.push(`    Sample flights:`);
    for (const s of p.sampleDates) {
      lines.push(`      ${s}`);
    }
    lines.push("");
  }

  lines.push("=== Interpretation Guide ===");
  lines.push(
    "• 'Mode' is the most common release timing — this is your best bet for when to start looking."
  );
  lines.push(
    "• If airline X via source A shows 14 days but via source B shows 7 days,"
  );
  lines.push(
    "  it means the airline releases to program A earlier than program B."
  );
  lines.push(
    "• More snapshots = more accurate patterns. Aim for 14-30 days of daily data."
  );

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86400000;
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / msPerDay
  );
}

function findMode(nums: number[]): number {
  const counts = new Map<number, number>();
  for (const n of nums) {
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  let mode = nums[0];
  let maxCount = 0;
  for (const [n, c] of counts) {
    if (c > maxCount) {
      maxCount = c;
      mode = n;
    }
  }
  return mode;
}
