import { z } from "zod";
import { apiRequest } from "../api.js";

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
    .enum(["economy", "premium", "business", "first"])
    .optional()
    .describe("Cabin class filter"),
  carriers: z
    .string()
    .optional()
    .describe("2-letter IATA airline code to filter (e.g. BR for EVA Air, JX for Starlux)"),
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
    carriers: args.carriers,
    only_direct_flights: args.only_direct_flights?.toString(),
    take: (args.take ?? 50).toString(),
    order_by: args.order_by,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: formatSearchResults(data),
      },
    ],
  };
}

function formatSearchResults(data: unknown): string {
  const result = data as {
    data?: Array<{
      ID?: string;
      RouteString?: string;
      Route?: { OriginAirport?: string; DestinationAirport?: string };
      Source?: string;
      Date?: string;
      YAvailable?: boolean;
      WAvailable?: boolean;
      JAvailable?: boolean;
      FAvailable?: boolean;
      YMileageCost?: string;
      WMileageCost?: string;
      JMileageCost?: string;
      FMileageCost?: string;
      YDirectMileageCost?: string;
      WDirectMileageCost?: string;
      JDirectMileageCost?: string;
      FDirectMileageCost?: string;
      YRemainingSeats?: number;
      WRemainingSeats?: number;
      JRemainingSeats?: number;
      FRemainingSeats?: number;
      YDirectAirlines?: string;
      WDirectAirlines?: string;
      JDirectAirlines?: string;
      FDirectAirlines?: string;
      YAirlines?: string;
      WAirlines?: string;
      JAirlines?: string;
      FAirlines?: string;
    }>;
    count?: number;
    hasMore?: boolean;
  };

  if (!result.data || result.data.length === 0) {
    return "No award flights found matching your criteria.";
  }

  const lines: string[] = [
    `Found ${result.count ?? result.data.length} results:`,
    "",
  ];

  for (const item of result.data) {
    const date = item.Date ?? "unknown";
    const source = item.Source ?? "unknown";
    const origin = item.Route?.OriginAirport ?? "?";
    const dest = item.Route?.DestinationAirport ?? "?";

    const cabins: string[] = [];
    if (item.JAvailable) {
      const miles = item.JDirectMileageCost || item.JMileageCost || "?";
      const seats = item.JRemainingSeats ?? "?";
      const airlines = item.JDirectAirlines || item.JAirlines || "";
      cabins.push(`Business: ${miles} mi, ${seats} seats, ${airlines}`);
    }
    if (item.FAvailable) {
      const miles = item.FDirectMileageCost || item.FMileageCost || "?";
      const seats = item.FRemainingSeats ?? "?";
      const airlines = item.FDirectAirlines || item.FAirlines || "";
      cabins.push(`First: ${miles} mi, ${seats} seats, ${airlines}`);
    }
    if (item.YAvailable) {
      const miles = item.YDirectMileageCost || item.YMileageCost || "?";
      const seats = item.YRemainingSeats ?? "?";
      cabins.push(`Economy: ${miles} mi, ${seats} seats`);
    }
    if (item.WAvailable) {
      const miles = item.WDirectMileageCost || item.WMileageCost || "?";
      const seats = item.WRemainingSeats ?? "?";
      cabins.push(`Premium: ${miles} mi, ${seats} seats`);
    }

    lines.push(`${date} | ${source} | ${origin}→${dest}`);
    for (const c of cabins) {
      lines.push(`  ${c}`);
    }
    lines.push("");
  }

  if (result.hasMore) {
    lines.push("(More results available — increase 'take' or use pagination)");
  }

  return lines.join("\n");
}
