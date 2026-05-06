import assert from "node:assert/strict";
import { test } from "node:test";

import { LearnDeroseApiClient } from "../src/api-client.mjs";

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] || headers[name] || null;
      }
    },
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
}

test("listBookableClasses calls the documented endpoint with read filters", async () => {
  const calls = [];
  const client = new LearnDeroseApiClient({
    apiBaseUrl: "https://learn.derose.app/api/v1",
    getAccessToken: async () => "access-token",
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return jsonResponse({ data: [] });
    }
  });

  await client.listBookableClasses({
    from: "2026-05-05",
    to: "2026-05-10",
    presenceType: "online",
    accountId: "15",
    teacherId: "42"
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://learn.derose.app/api/v1/bookable_classes?from=2026-05-05&to=2026-05-10&account_id=15&presence_type=online&teacher_id=42"
  );
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.Authorization, "Bearer access-token");
});

test("createBooking posts the documented booking payload", async () => {
  const calls = [];
  const client = new LearnDeroseApiClient({
    apiBaseUrl: "https://learn.derose.app/api/v1/",
    getAccessToken: async () => "access-token",
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return jsonResponse({ data: { id: 987 } }, { status: 201 });
    }
  });

  const response = await client.createBooking({
    postId: "123",
    bookedDate: "2026-05-06",
    waitlist: true
  });

  assert.deepEqual(response, { data: { id: 987 } });
  assert.equal(calls[0].url, "https://learn.derose.app/api/v1/bookings");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer access-token");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    booking: {
      post_id: 123,
      booked_date: "2026-05-06",
      waitlist: true
    }
  });
});

test("listBookings and showBooking call the current-user booking endpoints", async () => {
  const calls = [];
  const client = new LearnDeroseApiClient({
    apiBaseUrl: "https://learn.derose.app/api/v1",
    getAccessToken: async () => "access-token",
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return jsonResponse({ data: [] });
    }
  });

  await client.listBookings({
    state: "history",
    from: "2026-05-01",
    to: "2026-05-31"
  });
  await client.showBooking("987");

  assert.equal(
    calls[0].url,
    "https://learn.derose.app/api/v1/bookings?state=history&from=2026-05-01&to=2026-05-31"
  );
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[1].url, "https://learn.derose.app/api/v1/bookings/987");
  assert.equal(calls[1].options.method, "GET");
});

test("cancelBooking deletes the current user's booking endpoint", async () => {
  const calls = [];
  const client = new LearnDeroseApiClient({
    apiBaseUrl: "https://learn.derose.app/api/v1",
    getAccessToken: async () => "access-token",
    fetch: async (url, options) => {
      calls.push({ url: String(url), options });
      return jsonResponse({ data: { id: 987, status: "cancelled" } });
    }
  });

  await client.cancelBooking("987");

  assert.equal(calls[0].url, "https://learn.derose.app/api/v1/bookings/987");
  assert.equal(calls[0].options.method, "DELETE");
});
