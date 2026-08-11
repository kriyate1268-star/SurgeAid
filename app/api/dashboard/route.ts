import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");
      return Response.json(
        { error: "Supabase configuration is missing" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const [
      { data: severityRows },
      { data: statusRows },
      { data: disasterDates },
      { data: volunteerDates },
      { data: latencyRows },
    ] = await Promise.all([
      // Severity counts
      supabaseAdmin.rpc("count_by_severity"),

      // Status counts
      supabaseAdmin.rpc("count_by_status"),

      // Disaster time-series
      supabaseAdmin
        .from("disasters")
        .select("created_at")
        .order("created_at", { ascending: true }),

      // Volunteer signups
      supabaseAdmin
        .from("volunteers")
        .select("created_at")
        .order("created_at", { ascending: true }),

      // AI classification latency
      supabaseAdmin
        .from("disasters")
        .select("classify_ms")
        .not("classify_ms", "is", null),
    ]);

    // -----------------------------
    // Severity distribution
    // -----------------------------

    const severityCounts: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      UNKNOWN: 0,
    };

    for (const row of severityRows ?? []) {
      const severity = row.severity ?? "UNKNOWN";
      severityCounts[severity] = Number(row.count);
    }

    // -----------------------------
    // Status distribution
    // -----------------------------

    const statusCounts: Record<string, number> = {
      ACTIVE: 0,
      RESOLVED: 0,
      FALSE_ALARM: 0,
    };

    for (const row of statusRows ?? []) {
      const status = row.status ?? "ACTIVE";
      statusCounts[status] = Number(row.count);
    }

    // -----------------------------
    // Volunteer signups by day
    // Last 14 days
    // -----------------------------

    const now = new Date();

    const signupsByDay: Record<string, number> = {};

    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      const day = date.toISOString().slice(0, 10);
      signupsByDay[day] = 0;
    }

    for (const volunteer of volunteerDates ?? []) {
      if (!volunteer.created_at) continue;

      const day = String(volunteer.created_at).slice(0, 10);

      if (day in signupsByDay) {
        signupsByDay[day]++;
      }
    }

    // -----------------------------
    // Incidents by day
    // Last 14 days
    // -----------------------------

    const incidentsByDay: Record<string, number> = {};

    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      const day = date.toISOString().slice(0, 10);
      incidentsByDay[day] = 0;
    }

    for (const disaster of disasterDates ?? []) {
      if (!disaster.created_at) continue;

      const day = String(disaster.created_at).slice(0, 10);

      if (day in incidentsByDay) {
        incidentsByDay[day]++;
      }
    }

    // -----------------------------
    // Incidents by hour
    // -----------------------------

    const byHour: number[] = Array(24).fill(0);

    for (const disaster of disasterDates ?? []) {
      if (!disaster.created_at) continue;

      const hour = new Date(disaster.created_at).getHours();
      byHour[hour]++;
    }

    // -----------------------------
    // Totals
    // -----------------------------

    const totalDisasters = Object.values(severityCounts).reduce(
      (total, count) => total + count,
      0
    );

    const totalVolunteers = (volunteerDates ?? []).length;

    // -----------------------------
    // AI classification latency
    // -----------------------------

    const latencyValues = (latencyRows ?? [])
      .map((row) => Number(row.classify_ms))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    const latencyP50 =
      latencyValues.length > 0
        ? latencyValues[Math.floor(latencyValues.length * 0.5)]
        : null;

    const latencyP95 =
      latencyValues.length > 0
        ? latencyValues[
            Math.min(
              Math.floor(latencyValues.length * 0.95),
              latencyValues.length - 1
            )
          ]
        : null;

    // -----------------------------
    // Response
    // -----------------------------

    return Response.json({
      severityCounts,
      statusCounts,
      signupsByDay,
      incidentsByDay,
      byHour,

      totals: {
        disasters: totalDisasters,
        volunteers: totalVolunteers,
      },

      latency: {
        p50: latencyP50,
        p95: latencyP95,
        sampleSize: latencyValues.length,
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);

    return Response.json(
      {
        error: "Failed to load dashboard data",
      },
      { status: 500 }
    );
  }
}