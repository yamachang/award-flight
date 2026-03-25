import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SearchSchema, searchFlights } from "./tools/search.js";
import { BulkAvailSchema, getBulkAvailability } from "./tools/availability.js";
import { GetTripsSchema, getTrips } from "./tools/trips.js";

const server = new McpServer({
  name: "award-flight",
  version: "1.0.0",
});

// Tool 1: Cached Search — search specific airport pairs + date range
server.tool(
  "search_flights",
  `Search award flight availability between specific airports.
Use this when you know the origin/destination airports and travel dates.
Returns availability across ALL mileage programs (Alaska, Aeroplan, United, etc.)
with mileage costs, seat counts, and operating airlines.

Supported cabin classes: economy, premium, business, first.
Common airline codes: BR=EVA Air, JX=Starlux, CI=China Airlines, NH=ANA, CX=Cathay Pacific.`,
  SearchSchema.shape,
  async (params) => searchFlights(params)
);

// Tool 2: Bulk Availability — broad search by mileage program
server.tool(
  "bulk_availability",
  `Search bulk award availability for a specific mileage program (source).
Use this for broad regional searches when you want to explore what's available
in a particular loyalty program.

Sources: alaska, aeroplan, united, american, delta, emirates, qatar,
eurobonus, virginatlantic, aeromexico, etihad, velocity, qantas,
connectmiles, azul, smiles, flyingblue, jetblue, turkish, singapore,
ethiopian, saudia.`,
  BulkAvailSchema.shape,
  async (params) => getBulkAvailability(params)
);

// Tool 3: Get Trips — detailed flight info from an availability result
server.tool(
  "get_trips",
  `Get detailed flight/trip information from an availability result.
Use the ID from a search_flights or bulk_availability result to see
specific flight numbers, times, and connection details.`,
  GetTripsSchema.shape,
  async (params) => getTrips(params)
);

const transport = new StdioServerTransport();
await server.connect(transport);
