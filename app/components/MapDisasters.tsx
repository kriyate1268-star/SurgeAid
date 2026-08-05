"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
const markerIcons: Record<string, L.Icon> = {
  EARTHQUAKE: new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),

  FLOOD: new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),

  WILDFIRE: new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),

  CYCLONE: new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),

  LANDSLIDE: new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),

  STORM: new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }),
};
import { supabase } from "../../lib/supabase";
import type { Disaster } from "../../lib/types";

// Leaflet's default icon resolution breaks in bundlers; delete the internal
// URL resolver so mergeOptions takes over with explicit CDN paths.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface UsgsFeature {
  id: string;
  geometry: { coordinates: [number, number, number] };
  properties: { place: string; mag: number; time: number };
}

interface Props {
  center?: [number, number];
  zoom?: number;
}

export default function MapDisasters({ center = [20.5937, 78.9629], zoom = 5 }: Props) {
  const [mounted, setMounted] = useState(false);
  const [usgsFeatures, setUsgsFeatures] = useState<UsgsFeature[]>([]);
  const [localReports, setLocalReports] = useState<Disaster[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch("/api/disasters")
      .then((r) => r.json())
      .then((j) => setUsgsFeatures(j.features ?? []))
      .catch(() => setUsgsFeatures([]));
  }, []);

  useEffect(() => {
    supabase
      .from("disasters")
      .select("*")
      .then(({ data }) => setLocalReports((data as Disaster[]) ?? []));

    const channel = supabase
      .channel("map-disasters")
      .on("postgres_changes", { event: "*", schema: "public", table: "disasters" }, () => {
        supabase
          .from("disasters")
          .select("*")
          .then(({ data }) => setLocalReports((data as Disaster[]) ?? []));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!mounted) return <div className="w-full h-full rounded overflow-hidden shadow" />;

  return (
    <div className="w-full h-full rounded overflow-hidden shadow">
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains={["a", "b", "c", "d"]}
        />
        {usgsFeatures.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return (
            <Marker key={f.id} position={[lat, lng]}>
              <Popup>
                <div className="text-sm">
                  <strong>{f.properties.place}</strong><br />
                  Mag: {f.properties.mag}<br />
                  {new Date(f.properties.time).toLocaleString()}
                </div>
              </Popup>
            </Marker>
          );
        })}
        {localReports.filter((r) => r.lat && r.lng).map((r) => {
          const isResolved = r.status === 'RESOLVED' || r.status === 'FALSE_ALARM';
          const typeColors: Record<string, string> = {
            EARTHQUAKE: "#2563eb", // 🔵 Blue
            FLOOD: "#06b6d4",      // 🌊 Cyan
            WILDFIRE: "#ef4444",   // 🔥 Red
            CYCLONE: "#8b5cf6",    // 🌀 Purple
            LANDSLIDE: "#a16207",  // ⛰️ Brown
            STORM: "#eab308",      // ⛈️ Yellow
          };
          
          const markerColor = isResolved
          ? "#22c55e"
          : typeColors[r.type ?? "EARTHQUAKE"] ?? "#c1121f";

          const icon = isResolved
  ? markerIcons.EARTHQUAKE
  : markerIcons[r.type ?? "EARTHQUAKE"];
          return (
            <Marker key={r.id} position={[r.lat as number, r.lng as number]} icon={icon}>
              <Popup>
                <div className="text-sm">
                  <strong>{r.title}</strong><br />
                  <b>Type:</b>{" "}
                  <span style={{ color: markerColor, fontWeight: 600 }}>
                    {r.type ?? "EARTHQUAKE"}
                    </span>
                    <br />
                    
                    <span
                    style={{color: isResolved ? "#22c55e" : "#c1121f",fontWeight: 600,}}>
                      {r.status ?? "ACTIVE"}
                      </span>
                      
                      {r.severity && (<span style={{ marginLeft: 6, color: "#666" }}>
                        {r.severity}
                        </span>
                      )}
                      <br />
                      
                      {r.description}
                      <br />
                      {r.recommended_skills && (
                        <span style={{ color: "#3b82f6" }}>
                          Skills: {r.recommended_skills}
                          </span>
                        )}
                        {r.recommended_skills && <br />}
                        
                        {r.created_at? new Date(r.created_at).toLocaleString(): ""}
                        </div>
                        </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
