// Shared availability item type and formatter used by search, availability, and sweet-spots tools

export interface AvailabilityItem {
  ID?: string;
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
}

export function formatAvailabilityItems(
  items: AvailabilityItem[] | undefined,
  opts: { title?: string; count?: number; hasMore?: boolean } = {}
): string {
  if (!items || items.length === 0) {
    return "No award flights found matching your criteria.";
  }

  const lines: string[] = [];
  if (opts.title) {
    lines.push(`${opts.title} — ${opts.count ?? items.length} results:`);
  } else {
    lines.push(`Found ${opts.count ?? items.length} results:`);
  }
  lines.push("");

  for (const item of items) {
    const date = item.Date ?? "unknown";
    const source = item.Source ?? "unknown";
    const origin = item.Route?.OriginAirport ?? "?";
    const dest = item.Route?.DestinationAirport ?? "?";
    const idStr = item.ID ? ` (id:${item.ID})` : "";

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

    lines.push(`${date} | ${source} | ${origin}→${dest}${idStr}`);
    for (const c of cabins) {
      lines.push(`  ${c}`);
    }
    lines.push("");
  }

  if (opts.hasMore) {
    lines.push("(More results available — increase 'take' or use pagination)");
  }

  return lines.join("\n");
}

// Get the lowest mileage cost for a specific cabin from an item
export function getMileageCost(item: AvailabilityItem, cabin: string): number | null {
  let costStr: string | undefined;
  switch (cabin) {
    case "business":
      costStr = item.JDirectMileageCost || item.JMileageCost;
      break;
    case "first":
      costStr = item.FDirectMileageCost || item.FMileageCost;
      break;
    case "economy":
      costStr = item.YDirectMileageCost || item.YMileageCost;
      break;
    case "premium":
      costStr = item.WDirectMileageCost || item.WMileageCost;
      break;
  }
  if (!costStr) return null;
  const num = parseInt(costStr, 10);
  return isNaN(num) ? null : num;
}
