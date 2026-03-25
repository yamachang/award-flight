export const SOURCES = [
  "aeroplan",
  "aeromexico",
  "alaska",
  "american",
  "azul",
  "connectmiles",
  "delta",
  "emirates",
  "ethiopian",
  "etihad",
  "eurobonus",
  "flyingblue",
  "jetblue",
  "qatar",
  "qantas",
  "saudia",
  "singapore",
  "smiles",
  "turkish",
  "united",
  "velocity",
  "virginatlantic",
] as const;

export type Source = (typeof SOURCES)[number];

export const CABIN_CLASSES = ["economy", "premium", "business", "first"] as const;
export type CabinClass = (typeof CABIN_CLASSES)[number];

export const REGIONS = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia",
  "Oceania",
  "Middle East",
] as const;
export type Region = (typeof REGIONS)[number];

// Credit card transfer partner mappings
// Source: which seats.aero source to search
export const TRANSFER_PARTNERS = {
  chase: {
    label: "Chase Ultimate Rewards",
    sources: ["united", "aeroplan", "virginatlantic", "singapore", "flyingblue", "emirates", "jetblue"] as const,
  },
  amex: {
    label: "Amex Membership Rewards",
    sources: ["aeroplan", "delta", "emirates", "etihad", "flyingblue", "singapore", "virginatlantic"] as const,
  },
  aa: {
    label: "American AAdvantage",
    sources: ["american"] as const,
  },
  capitalOne: {
    label: "Capital One",
    sources: ["turkish", "etihad", "singapore", "qantas", "virginatlantic", "flyingblue"] as const,
  },
  citi: {
    label: "Citi ThankYou",
    sources: ["turkish", "singapore", "virginatlantic", "etihad", "qatar"] as const,
  },
} as const;

// Common sweet spot redemptions
export const SWEET_SPOTS = `
Key sweet spot redemptions:
- Alaska 25K → Starlux (JX) business TPE routes
- Virgin Atlantic 60-90K → ANA (NH) business "The Room" / 120K first "The Suite"
- AA 60K → JAL (JL) business / 80K first
- Aeroplan 75K → EVA Air (BR) / ANA business to Asia
- Turkish 45K → Star Alliance business to Japan
- United 70K saver → Star Alliance business to Asia (less value but easy to find)

Cross-booking trick:
When Source=united shows ANA (NH) at 110K business or 220K first class,
it means ANA released partner award space. You can then book the SAME flights
through Virgin Atlantic for only 60-90K business or 120K first (transfer from Chase/Amex).
` as const;

// Major European airport codes for region searches
export const EUROPE_AIRPORTS = "LHR,CDG,FRA,AMS,FCO,MAD,BCN,LIS,DUB,ZRH,VIE,CPH,OSL,ARN,HEL,ATH,IST,WAW,PRG,BRU,MUC,MXP,BER,GVA,EDI,MAN,ORY,NCE,NAP,BUD,OTP,SOF,ZAG,TLL,RIX,VNO,KEF";

// Major US East Coast airports
export const US_EAST_AIRPORTS = "JFK,EWR,BOS,IAD,DCA,PHL,CLT,ATL,MIA,FLL,MCO,DTW,ORD";

// Major Asian airports
export const ASIA_AIRPORTS = "NRT,HND,KIX,TPE,ICN,HKG,SIN,BKK,DEL,BOM,MNL,SGN,HAN,KUL,CGK";
