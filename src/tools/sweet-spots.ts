import { z } from "zod";
import { apiRequest, throttledApiRequests } from "../api.js";
import { SOURCES, CABIN_CLASSES, type Source } from "../constants.js";
import { type AvailabilityItem, formatAvailabilityItems, getMileageCost } from "../format.js";

const DEFAULT_SOURCES: readonly Source[] = [
  "alaska", "aeroplan", "united", "american", "virginatlantic",
  "delta", "emirates", "qatar", "turkish", "singapore",
  "flyingblue", "etihad",
];

export const SweetSpotsSchema = z.object({
  origin: z
    .string()
    .describe("Origin airport IATA codes, comma-separated (e.g. JFK,EWR,BOS)"),
  destination: z
    .string()
    .optional()
    .describe("Destination airport IATA codes, comma-separated. If omitted, uses destination_region instead."),
  destination_region: z
    .string()
    .optional()
    .describe("Destination region (e.g. Europe, Asia, North America). Used when destination airports not specified."),
  origin_region: z
    .string()
    .optional()
    .describe("Origin region (e.g. North America). Used for bulk availability when specific airports not needed."),
  cabin: z
    .enum(CABIN_CLASSES)
    .describe("Cabin class to search"),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Start date in YYYY-MM-DD format"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("End date in YYYY-MM-DD format"),
  max_mileage: z
    .number()
    .optional()
    .describe("Maximum mileage cost filter — only show results below this threshold (great for finding deals)"),
  sources: z
    .array(z.enum(SOURCES))
    .optional()
    .describe("Which mileage programs to search. Defaults to major programs: alaska, aeroplan, united, american, virginatlantic, delta, emirates, qatar, turkish, singapore, flyingblue, etihad"),
  top_n: z
    .number()
    .optional()
    .describe("Number of top results to return (default 30)"),
});

export async function searchSweetSpots(
  args: z.infer<typeof SweetSpotsSchema>
) {
  const sources = args.sources ?? [...DEFAULT_SOURCES];
  const topN = args.top_n ?? 30;

  // Build API requests for each source
  const requests = sources.map((source) => {
    return () => {
      // If specific airports given, use /search endpoint; otherwise use /availability with regions
      if (args.origin || args.destination) {
        return apiRequest("/search", {
          origin_airport: args.origin,
          destination_airport: args.destination,
          start_date: args.start_date,
          end_date: args.end_date,
          cabin_class: args.cabin,
          source,
          take: "200",
          order_by: "lowest_mileage",
        });
      } else {
        return apiRequest("/availability", {
          source,
          cabin: args.cabin,
          start_date: args.start_date,
          end_date: args.end_date,
          origin_region: args.origin_region,
          destination_region: args.destination_region,
          take: "200",
        });
      }
    };
  });

  const results = await throttledApiRequests(requests);

  // Collect all items
  let allItems: AvailabilityItem[] = [];
  const errors: string[] = [];

  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      const data = result.value as { data?: AvailabilityItem[] };
      if (data.data) {
        allItems.push(...data.data);
      }
    } else {
      errors.push(`${sources[i]}: ${result.reason}`);
    }
  }

  // Filter by cabin availability
  allItems = allItems.filter((item) => {
    switch (args.cabin) {
      case "business": return item.JAvailable;
      case "first": return item.FAvailable;
      case "economy": return item.YAvailable;
      case "premium": return item.WAvailable;
      default: return true;
    }
  });

  // Filter by max mileage if specified
  if (args.max_mileage) {
    allItems = allItems.filter((item) => {
      const cost = getMileageCost(item, args.cabin);
      return cost !== null && cost <= args.max_mileage!;
    });
  }

  // Sort by mileage cost (lowest first)
  allItems.sort((a, b) => {
    const costA = getMileageCost(a, args.cabin) ?? Infinity;
    const costB = getMileageCost(b, args.cabin) ?? Infinity;
    return costA - costB;
  });

  // Take top N
  const topItems = allItems.slice(0, topN);

  const title = `Sweet spots: top ${topItems.length} cheapest ${args.cabin} class results across ${sources.length} programs`;
  let text = formatAvailabilityItems(topItems, {
    title,
    count: allItems.length,
    hasMore: allItems.length > topN,
  });

  if (errors.length > 0) {
    text += `\n\nWarnings (${errors.length} sources had errors):\n${errors.map((e) => `  - ${e}`).join("\n")}`;
  }

  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}
