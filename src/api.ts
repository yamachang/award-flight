const BASE_URL = "https://seats.aero/partnerapi";

export function getApiKey(): string {
  const key = process.env.SEATS_API_KEY;
  if (!key) {
    throw new Error("SEATS_API_KEY environment variable is not set");
  }
  return key;
}

export async function apiRequest(
  path: string,
  params: Record<string, string | undefined>
): Promise<unknown> {
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      queryParams.append(key, value);
    }
  }

  const url = `${BASE_URL}${path}?${queryParams.toString()}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "Partner-Authorization": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`seats.aero API error (${response.status}): ${errorText}`);
  }

  return response.json();
}
