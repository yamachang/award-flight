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

// Throttled parallel API requests with concurrency limit
const MAX_CONCURRENT = 4;

export async function throttledApiRequests<T>(
  requests: Array<() => Promise<T>>
): Promise<Array<{ status: "fulfilled"; value: T } | { status: "rejected"; reason: string }>> {
  const results: Array<{ status: "fulfilled"; value: T } | { status: "rejected"; reason: string }> = [];
  const executing = new Set<Promise<void>>();

  for (const [i, reqFn] of requests.entries()) {
    const promise = (async () => {
      try {
        const value = await reqFn();
        results[i] = { status: "fulfilled", value };
      } catch (err) {
        results[i] = {
          status: "rejected",
          reason: err instanceof Error ? err.message : "Unknown error",
        };
      }
    })();

    executing.add(promise);
    promise.then(() => executing.delete(promise));

    if (executing.size >= MAX_CONCURRENT) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}
