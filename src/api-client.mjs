import { ApiError } from "./errors.mjs";
import { DEFAULT_API_BASE_URL, fetchFailureError } from "./oauth.mjs";

export class LearnDeroseApiClient {
  constructor({
    apiBaseUrl = DEFAULT_API_BASE_URL,
    getAccessToken,
    fetch: fetchImpl = globalThis.fetch,
    locale,
    logger = null
  }) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    this.getAccessToken = getAccessToken;
    this.fetch = fetchImpl;
    this.locale = locale;
    this.logger = logger;
  }

  listBookableClasses(filters = {}) {
    return this.request("GET", "/bookable_classes", {
      query: {
        from: filters.from,
        to: filters.to,
        account_id: filters.accountId,
        presence_type: filters.presenceType,
        teacher_id: filters.teacherId
      }
    });
  }

  listBookings(filters = {}) {
    return this.request("GET", "/bookings", {
      query: {
        state: filters.state,
        from: filters.from,
        to: filters.to
      }
    });
  }

  showBooking(id) {
    return this.request("GET", `/bookings/${encodeURIComponent(id)}`);
  }

  createBooking({ postId, bookedDate, waitlist = false }) {
    return this.request("POST", "/bookings", {
      body: {
        booking: {
          post_id: Number(postId),
          booked_date: bookedDate,
          waitlist: Boolean(waitlist)
        }
      }
    });
  }

  cancelBooking(id) {
    return this.request("DELETE", `/bookings/${encodeURIComponent(id)}`);
  }

  async request(method, resourcePath, { query = {}, body } = {}) {
    const accessToken = await this.getAccessToken();
    const url = new URL(`${this.apiBaseUrl}${resourcePath}`);

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }

    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`
    };

    if (this.locale) headers["X-Locale"] = this.locale;
    if (body) headers["Content-Type"] = "application/json";

    this.logger?.debug(`HTTP ${method} ${url}`);

    let response;
    try {
      response = await this.fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (error) {
      throw fetchFailureError({
        error,
        label: "Learn API endpoint",
        method,
        url
      });
    }

    this.logger?.debug(`HTTP ${method} ${url} -> ${response.status}`);

    const payload = await readJson(response);

    if (!response.ok) {
      const message = payload?.message || payload?.error || `Learn API request failed with ${response.status}`;
      throw new ApiError(message, {
        status: response.status,
        payload
      });
    }

    return payload;
  }
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
