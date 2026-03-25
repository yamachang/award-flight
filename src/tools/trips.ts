import { z } from "zod";
import { apiRequest } from "../api.js";

export const GetTripsSchema = z.object({
  id: z
    .string()
    .describe("The availability ID from a search result to get detailed trip/flight info"),
});

export async function getTrips(args: z.infer<typeof GetTripsSchema>) {
  const data = await apiRequest(`/trips/${args.id}`, {});

  return {
    content: [
      {
        type: "text" as const,
        text: `Trip details:\n\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}
