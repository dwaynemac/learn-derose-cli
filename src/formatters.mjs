export function formatClasses(payload) {
  const rows = payload?.data || [];
  if (rows.length === 0) return "No classes found.\n";

  return formatTable(rows, [
    ["post_id", "Post"],
    ["booked_date", "Date"],
    ["starts_at", "Starts"],
    ["presence_type", "Type"],
    ["title", "Title"],
    [(row) => row.account?.name || "", "Account"],
    [(row) => row.teacher?.name || "", "Teacher"],
    [(row) => booleanLabel(row.requires_booking), "Requires booking"],
    [(row) => spotLabel(row), "Spots"]
  ]);
}

export const formatBookableClasses = formatClasses;

export function formatBookings(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : [payload?.data].filter(Boolean);
  if (rows.length === 0) return "No bookings found.\n";

  return formatTable(rows, [
    ["id", "ID"],
    ["booked_date", "Date"],
    ["starts_at", "Starts"],
    ["status", "Status"],
    ["presence_type", "Type"],
    ["title", "Title"],
    [(row) => row.account?.name || "", "Account"]
  ]);
}

function spotLabel(row) {
  if (row.can_join_waiting_list) return `waitlist (${row.waiting_list_count || 0})`;
  if (row.available_spots === null || row.available_spots === undefined) return "";
  return String(row.available_spots);
}

function booleanLabel(value) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

function formatTable(rows, columns) {
  const values = rows.map((row) => columns.map(([reader]) => readValue(row, reader)));
  const headers = columns.map(([, header]) => header);
  const widths = headers.map((header, index) => {
    return Math.max(header.length, ...values.map((row) => row[index].length));
  });

  const lines = [
    headers.map((header, index) => header.padEnd(widths[index])).join("  "),
    widths.map((width) => "-".repeat(width)).join("  ")
  ];

  for (const row of values) {
    lines.push(row.map((value, index) => value.padEnd(widths[index])).join("  "));
  }

  return `${lines.join("\n")}\n`;
}

function readValue(row, reader) {
  const value = typeof reader === "function" ? reader(row) : row[reader];
  return value === null || value === undefined ? "" : String(value);
}
