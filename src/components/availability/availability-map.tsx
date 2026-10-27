"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  level: "confirmed" | "aging" | "stale" | "excluded" | "unconfirmed";
  summary: string;
  phone: string;
  synthetic: boolean;
}

const COLORS: Record<MapPoint["level"], string> = {
  confirmed: "#24473b",
  aging: "#8a5a12",
  stale: "#782a38",
  excluded: "#782a38",
  unconfirmed: "#5f635d",
};

function icon(level: MapPoint["level"]) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${COLORS[level]};border:2px solid #f5f0e7;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

function Fit({ points, origin }: { points: MapPoint[]; origin: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = points.map((p) => [p.lat, p.lng]);
    if (origin) coords.push([origin.lat, origin.lng]);
    if (coords.length) map.fitBounds(L.latLngBounds(coords), { padding: [32, 32], maxZoom: 13 });
  }, [map, points, origin]);
  return null;
}

export default function AvailabilityMap({ points, origin }: { points: MapPoint[]; origin: { lat: number; lng: number } | null }) {
  const tile = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "&copy; OpenStreetMap contributors";
  return (
    <div role="region" aria-label="Map of blood centres" className="overflow-hidden rounded-[var(--radius-card)] border border-line">
      <MapContainer center={[20.5, 78.9]} zoom={5} scrollWheelZoom={false} className="h-[360px] w-full md:h-[480px]">
        <TileLayer url={tile} attribution={attribution} />
        <Fit points={points} origin={origin} />
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icon(p.level)} alt={p.name}>
            <Popup>
              <strong>{p.name}</strong>
              {p.synthetic && <div style={{ color: "#8a5a12" }}>Synthetic demo</div>}
              <div>{p.summary}</div>
              <a href={`tel:${p.phone}`}>Call {p.phone}</a>
            </Popup>
          </Marker>
        ))}
        {origin && (
          <Marker
            position={[origin.lat, origin.lng]}
            alt="Your chosen location"
            icon={L.divIcon({ className: "", html: '<span style="display:block;width:14px;height:14px;background:#252724;border:2px solid #f5f0e7;transform:rotate(45deg)"></span>', iconSize: [14, 14], iconAnchor: [7, 7] })}
          >
            <Popup>Your chosen location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
