export async function GET() {
  const url =
  "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=6&maxlatitude=38&minlongitude=68&maxlongitude=98&orderby=time";

  try {
    const res = await fetch(url);
    const json = await res.json();

    return Response.json(json);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch disasters" }, { status: 500 });
  }
}
