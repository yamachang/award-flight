import { z } from "zod";
import { apiRequest } from "../api.js";

export const GetTripsSchema = z.object({
  id: z
    .string()
    .describe("The availability ID from a search result to get detailed trip/flight info"),
});

interface TripSegment {
  FlightNumber?: string;
  AircraftCode?: string;
  FareClass?: string;
  OriginAirport?: string;
  DestinationAirport?: string;
  DepartsAt?: string;
  ArrivesAt?: string;
  Cabin?: string;
  Distance?: number;
}

interface TripData {
  ID?: string;
  Carriers?: string;
  FlightNumbers?: string;
  TotalDuration?: number;
  Stops?: number;
  RemainingSeats?: number;
  MileageCost?: string;
  TotalTaxes?: string;
  TaxesCurrency?: string;
  DepartsAt?: string;
  ArrivesAt?: string;
  Cabin?: string;
  Source?: string;
  AvailabilitySegments?: TripSegment[];
}

interface TripResponse {
  data?: TripData[];
  booking_links?: Array<{ label?: string; link?: string; primary?: boolean }>;
}

export async function getTrips(args: z.infer<typeof GetTripsSchema>) {
  const data = await apiRequest(`/trips/${args.id}`, {});
  const response = data as TripResponse;

  return {
    content: [
      {
        type: "text" as const,
        text: formatTrips(response),
      },
    ],
  };
}

function formatTrips(response: TripResponse): string {
  if (!response.data || response.data.length === 0) {
    return "No trip details found for this ID.";
  }

  const lines: string[] = [`Found ${response.data.length} itinerary option(s):`, ""];

  for (const [i, trip] of response.data.entries()) {
    const cabin = trip.Cabin ?? "?";
    const miles = trip.MileageCost ?? "?";
    const taxes = trip.TotalTaxes ? `$${trip.TotalTaxes} ${trip.TaxesCurrency ?? ""}` : "";
    const seats = trip.RemainingSeats ?? "?";
    const stops = trip.Stops ?? 0;
    const duration = trip.TotalDuration ? formatDuration(trip.TotalDuration) : "?";
    const source = trip.Source ?? "?";

    lines.push(`--- Option ${i + 1} ---`);
    lines.push(`${cabin} | ${miles} mi | ${seats} seats | ${stops} stop(s) | ${duration} total | ${source}`);
    if (taxes) lines.push(`Taxes: ${taxes}`);
    lines.push("");

    if (trip.AvailabilitySegments && trip.AvailabilitySegments.length > 0) {
      for (const seg of trip.AvailabilitySegments) {
        const flight = seg.FlightNumber ?? "?";
        const aircraft = seg.AircraftCode ? ` (${seg.AircraftCode})` : "";
        const orig = seg.OriginAirport ?? "?";
        const dest = seg.DestinationAirport ?? "?";
        const depart = seg.DepartsAt ? formatTime(seg.DepartsAt) : "?";
        const arrive = seg.ArrivesAt ? formatTime(seg.ArrivesAt) : "?";
        const fareClass = seg.FareClass ? ` [${seg.FareClass}]` : "";

        lines.push(`  ${flight}${aircraft}${fareClass}: ${orig} ${depart} → ${dest} ${arrive}`);
      }
      lines.push("");
    }
  }

  if (response.booking_links && response.booking_links.length > 0) {
    lines.push("Booking links:");
    for (const link of response.booking_links) {
      const primary = link.primary ? " (recommended)" : "";
      lines.push(`  ${link.label ?? "Link"}${primary}: ${link.link ?? ""}`);
    }
  }

  return lines.join("\n");
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? `${m}m` : ""}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const mins = String(d.getUTCMinutes()).padStart(2, "0");
    return `${month}/${day} ${hours}:${mins}`;
  } catch {
    return iso;
  }
}
