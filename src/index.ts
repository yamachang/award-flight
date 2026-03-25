import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SearchSchema, searchFlights } from "./tools/search.js";
import { BulkAvailSchema, getBulkAvailability } from "./tools/availability.js";
import { GetTripsSchema, getTrips } from "./tools/trips.js";
import { SweetSpotsSchema, searchSweetSpots } from "./tools/sweet-spots.js";
import { ReleasePatternSchema, detectReleasePatterns } from "./tools/release-patterns.js";
import { CollectSnapshotSchema, collectSnapshot, AnalyzePatternsSchema, analyzeReleasePatterns } from "./tools/snapshot.js";

const server = new McpServer({
  name: "award-flight",
  version: "1.1.0",
});

// Tool 1: Cached Search — search specific airport pairs + date range
server.tool(
  "search_flights",
  `Search award flight availability between specific airports.
Use this when you know the origin/destination airports and travel dates.
Returns availability across all mileage programs with mileage costs, seat counts, and airlines.
Can filter by source (mileage program) to target specific programs.

Common airline codes: BR=EVA Air, JX=Starlux, CI=China Airlines, NH=ANA, JL=JAL, CX=Cathay Pacific, SQ=Singapore.

Credit card transfer partners (which source to search):
- Chase Ultimate Rewards → united, aeroplan, virginatlantic, singapore, flyingblue, emirates, jetblue
- Amex Membership Rewards → aeroplan, delta, emirates, etihad, flyingblue, singapore, virginatlantic
- AA miles → american

Cross-booking trick for ANA flights:
When source=united shows ANA (NH) flights at 110K business or 220K first, it means ANA released partner award space.
You can book the SAME flights through Virgin Atlantic for only 60-90K business or 120K first class (transfer from Chase/Amex).
So: search with source=united, carriers=NH to detect ANA availability, then advise booking via Virgin Atlantic.

Sweet spot redemptions:
- Alaska 25K one-way → Starlux (JX) business
- Virgin Atlantic 60-90K → ANA (NH) business "The Room" / 120K first "The Suite"
- AA 60K → JAL (JL) business / 80K first
- Aeroplan 75K → EVA Air (BR) or ANA business to Asia
- Turkish 45K → Star Alliance business to Japan

Major airport groups for convenience:
- US East Coast: JFK,EWR,BOS,IAD,DCA,PHL,CLT,ATL,MIA,FLL,MCO,DTW,ORD
- Europe: LHR,CDG,FRA,AMS,FCO,MAD,BCN,LIS,DUB,ZRH,VIE,CPH,MUC,MXP,BER
- Asia: NRT,HND,KIX,TPE,ICN,HKG,SIN,BKK,MNL,KUL`,
  SearchSchema.shape,
  async (params) => searchFlights(params)
);

// Tool 2: Bulk Availability — broad search by mileage program
server.tool(
  "bulk_availability",
  `Search bulk award availability for a specific mileage program (source).
Use this for broad regional searches to explore what's available across many routes in one program.

When to use which source for which airline:
- alaska: Starlux (JX), JAL (JL), Cathay Pacific (CX), Qantas — Oneworld partners
- virginatlantic: ANA (NH) business/first — best for The Room/The Suite via Amex/Chase transfer
- american: JAL (JL), Cathay Pacific (CX), Qantas — AA miles or Oneworld partners
- united: ANA (NH), EVA Air (BR), Lufthansa, Swiss — Star Alliance (also use to detect ANA partner space)
- aeroplan: ANA (NH), EVA Air (BR), Lufthansa, Swiss, Turkish — Star Alliance
- turkish: Star Alliance wide, great for business class to Asia/Europe
- delta: Korean Air, Air France — SkyTeam
- flyingblue: Air France, KLM, Korean Air — SkyTeam

Regions: North America, South America, Europe, Africa, Asia, Oceania, Middle East`,
  BulkAvailSchema.shape,
  async (params) => getBulkAvailability(params)
);

// Tool 3: Get Trips — detailed flight info from an availability result
server.tool(
  "get_trips",
  `Get detailed flight/trip information from an availability result.
Use the ID from a search_flights or bulk_availability result to see
specific flight numbers, departure/arrival times, aircraft, and connections.`,
  GetTripsSchema.shape,
  async (params) => getTrips(params)
);

// Tool 4: Sweet Spots — find cheapest redemptions across programs
server.tool(
  "search_sweet_spots",
  `Find the cheapest award redemptions across multiple mileage programs at once.
Use this when looking for the best deals, comparing programs, or finding bug fares.

Searches multiple mileage program sources in parallel and returns results
ranked by mileage cost (lowest first). Great for:
- "What's the cheapest business class BOS to Europe?"
- "Find me the best deals from US East Coast to Asia"
- "Any bug fares or unusually cheap awards from JFK?"

You can limit which sources to search, set a max mileage threshold,
and filter by region. Results include the source program so you know
which points/miles to use.`,
  SweetSpotsSchema.shape,
  async (params) => searchSweetSpots(params)
);

// Tool 5: Detect Release Patterns — instant analysis from single query
server.tool(
  "detect_release_patterns",
  `Detect airline award seat release patterns by analyzing current availability.
Scans the next 60 days (configurable) to infer when each airline releases partner award seats.

How it works: If ANA business class via united is only available for flights within the next 10 days,
it likely means ANA releases partner seats ~10 days before departure.

Use this for quick one-time analysis. For precise patterns, use collect_snapshot + analyze_release_patterns.

Examples:
- "When does ANA release business class seats?" → origin=JFK,EWR,ORD, destination=NRT,HND, cabin=business
- "Release patterns for all airlines US to Asia" → origin=JFK,EWR,ORD,LAX,SFO, destination=NRT,HND,TPE,ICN,SIN, cabin=business

Common airlines: NH=ANA, JL=JAL, BR=EVA Air, JX=Starlux, CX=Cathay Pacific, SQ=Singapore, TK=Turkish`,
  ReleasePatternSchema.shape,
  async (params) => detectReleasePatterns(params)
);

// Tool 6: Collect Snapshot — daily data collection for pattern tracking
server.tool(
  "collect_snapshot",
  `Collect and save a snapshot of current award availability for long-term pattern analysis.
Run this DAILY for 2-4 weeks to build enough data for accurate release pattern detection.

Saves data to local JSON files. Each snapshot records which flights are available today,
so over time we can see exactly when new seats first appear.

Tip: Set up a daily cron job or reminder to run this consistently.
After collecting enough data, use analyze_release_patterns to find the patterns.`,
  CollectSnapshotSchema.shape,
  async (params) => collectSnapshot(params)
);

// Tool 7: Analyze Release Patterns — find patterns from collected snapshots
server.tool(
  "analyze_release_patterns",
  `Analyze collected snapshots to find precise award seat release patterns.
Requires data from collect_snapshot (run daily for 2-4 weeks).

Compares snapshots over time to determine exactly how many days before departure
each airline releases seats to each mileage program.

Output includes: min/max/median/mode days before departure, broken down by airline and mileage program.
This reveals patterns like "ANA releases to Star Alliance partners 14 days out, but to own program 21 days out."`,
  AnalyzePatternsSchema.shape,
  async (params) => analyzeReleasePatterns(params)
);

const transport = new StdioServerTransport();
await server.connect(transport);
