import { z } from "zod";
import { apiRequest } from "../api.js";

const SOURCES = [
  "eurobonus",
  "virginatlantic",
  "aeromexico",
  "american",
  "delta",
  "etihad",
  "united",
  "emirates",
  "aeroplan",
  "alaska",
  "velocity",
  "qantas",
  "connectmiles",
  "azul",
  "smiles",
  "flyingblue",
  "jetblue",
  "qatar",
  "turkish",
  "singapore",
  "ethiopian",
  "saudia",
] as const;

export const BulkAvailSchema = z.object({
  source: z
    .enum(SOURCES)
    .describe("Mileage program source (e.g. alaska, aeroplan, united)"),
  cabin: z
    .enum(["economy", "premium", "business", "first"])
    .optional()
    .describe("Cabin class filter"),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Start date in YYYY-MM-DD format"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("End date in YYYY-MM-DD format"),
  origin_region: z
    .string()
    .optional()
    .describe("Origin region filter (e.g. North America, Asia)"),
  destination_region: z
    .string()
    .optional()
    .describe("Destination region filter"),
  take: z.number().optional().describe("Number of results (default 50, max 1000)"),
});

export async function getBulkAvailability(
  args: z.infer<typeof BulkAvailSchema>
) {
  const data = await apiRequest("/availability", {
    source: args.source,
    cabin: args.cabin,
    start_date: args.start_date,
    end_date: args.end_date,
    origin_region: args.origin_region,
    destination_region: args.destination_region,
    take: (args.take ?? 50).toString(),
  });

  return {
    content: [
      {
        type: "text" as const,
        text: `Bulk availability for ${args.source}:\n\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}
