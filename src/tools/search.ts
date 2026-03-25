import { z } from "zod";
import { apiRequest } from "../api.js";
import { SOURCES, CABIN_CLASSES } from "../constants.js";
import { type AvailabilityItem, formatAvailabilityItems } from "../format.js";

export const SearchSchema = z.object({
  origin: z
    .string()
    .describe("Origin airport IATA code (e.g. TPE). Multiple codes comma-separated."),
  destination: z
    .string()
    .describe("Destination airport IATA code (e.g. SDJ). Multiple codes comma-separated."),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Start date in YYYY-MM-DD format"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("End date in YYYY-MM-DD format"),
  cabin: z
    .enum(CABIN_CLASSES)
    .optional()
    .describe("Cabin class filter"),
  source: z
    .enum(SOURCES)
    .optional()
    .describe("Filter by mileage program source (e.g. united, alaska, virginatlantic). If omitted, searches all programs."),
  carriers: z
    .string()
    .optional()
    .describe("2-letter IATA airline code to filter (e.g. BR for EVA Air, JX for Starlux, NH for ANA, JL for JAL)"),
  only_direct_flights: z
    .boolean()
    .optional()
    .describe("Only show direct flights"),
  take: z.number().optional().describe("Number of results to return (default 50, max 1000)"),
  order_by: z
    .enum(["", "lowest_mileage"])
    .optional()
    .describe("Sort order"),
});

export async function searchFlights(
  args: z.infer<typeof SearchSchema>
) {
  const data = await apiRequest("/search", {
    origin_airport: args.origin,
    destination_airport: args.destination,
    start_date: args.start_date,
    end_date: args.end_date,
    cabin_class: args.cabin,
    source: args.source,
    carriers: args.carriers,
    only_direct_flights: args.only_direct_flights?.toString(),
    take: (args.take ?? 50).toString(),
    order_by: args.order_by,
  });

  const result = data as { data?: AvailabilityItem[]; count?: number; hasMore?: boolean };

  // Client-side source filter as fallback if API doesn't support it
  if (args.source && result.data) {
    result.data = result.data.filter(
      (item) => item.Source?.toLowerCase() === args.source
    );
  }

  return {
    content: [
      {
        type: "text" as const,
        text: formatAvailabilityItems(result.data, {
          count: result.count,
          hasMore: result.hasMore,
        }),
      },
    ],
  };
}
