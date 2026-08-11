import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const q = searchParams.get("q")?.trim() ?? "";

  const page = Math.max(
    0,
    parseInt(searchParams.get("page") ?? "0", 10)
  );

  const pageSize = 10;

  try {
    // -----------------------------
    // Supabase configuration
    // -----------------------------

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");

      return Response.json(
        {
          error: "Supabase configuration is missing",
        },
        {
          status: 500,
        }
      );
    }

    // -----------------------------
    // Create Supabase admin client
    // -----------------------------

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // -----------------------------
    // Search disasters
    // -----------------------------

    let query = supabaseAdmin
      .from("disasters")
      .select(
        "id,title,description,severity,status,recommended_skills,lat,lng,created_at",
        {
          count: "exact",
        }
      )
      .order("created_at", {
        ascending: false,
      })
      .range(
        page * pageSize,
        page * pageSize + pageSize - 1
      );

    // -----------------------------
    // Full-text search
    // -----------------------------

    if (q) {
      query = query.textSearch(
        "title",
        q,
        {
          type: "websearch",
          config: "english",
        }
      );
    }

    // -----------------------------
    // Execute query
    // -----------------------------

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    // -----------------------------
    // Return results
    // -----------------------------

    return Response.json({
      results: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("Search error:", err);

    return Response.json(
      {
        results: [],
        total: 0,
        page,
        pageSize,
      },
      {
        status: 500,
      }
    );
  }
}