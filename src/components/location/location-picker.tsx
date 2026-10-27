"use client";

import { useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";

export interface PickedLocation {
  lat: number;
  lng: number;
  label?: string;
}

export interface CityOption {
  city: string;
  lat: number;
  lng: number;
}

interface Props {
  value: PickedLocation | null;
  onChange: (v: PickedLocation | null) => void;
  cities?: CityOption[];
  error?: string;
  idPrefix: string;
}

export function LocationPicker({ value, onChange, cities = [], error, idPrefix }: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<null | "gps" | "search">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);

  function locate() {
    setMessage(null);
    if (!("geolocation" in navigator)) return setMessage("Your browser cannot share its location. Search for an address or choose a city.");
    setBusy("gps");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(null);
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your current location" });
      },
      () => {
        setBusy(null);
        setMessage("Location permission was denied or unavailable. Search for an address or choose a city.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function search() {
    setMessage(null);
    setResults([]);
    if (query.trim().length < 3) return setMessage("Enter at least 3 characters.");
    setBusy("search");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const body = await res.json();
      if (!res.ok) setMessage(res.status === 501 ? "Address search is not enabled here. Use your location or choose a city." : (body.error ?? "Search failed."));
      else if (!body.results.length) setMessage("No places found. Try a different search or choose a city.");
      else setResults(body.results);
    } catch {
      setMessage("Could not reach address search. Check your connection.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-line bg-ivory/60 p-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={locate} loading={busy === "gps"}>
          <LocateFixed size={16} aria-hidden /> Use my location
        </Button>
        {cities.length > 0 && (
          <div className="min-w-40 flex-1">
            <label htmlFor={`${idPrefix}-city`} className="sr-only">Choose a city</label>
            <Select
              id={`${idPrefix}-city`}
              value=""
              onChange={(e) => {
                const c = cities.find((x) => x.city === e.target.value);
                if (c) onChange({ lat: c.lat, lng: c.lng, label: c.city });
              }}
            >
              <option value="">Or choose a city…</option>
              {cities.map((c) => (
                <option key={c.city} value={c.city}>{c.city}</option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <label htmlFor={`${idPrefix}-q`} className="sr-only">Search for an address</label>
        <Input
          id={`${idPrefix}-q`}
          value={query}
          placeholder="Search an address or area"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <Button variant="outline" onClick={search} loading={busy === "search"} aria-label="Search address">
          <Search size={16} aria-hidden />
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line bg-paper text-sm">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-ivory-deep"
                onClick={() => {
                  onChange({ lat: r.lat, lng: r.lng, label: r.label });
                  setResults([]);
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p role="status" className="text-xs text-muted">{message}</p>}
      <p className="flex items-center gap-1.5 text-sm" aria-live="polite">
        <MapPin size={14} aria-hidden className={value ? "text-forest" : "text-muted"} />
        {value ? <span>{value.label ?? "Location set"} <span className="text-muted">({value.lat.toFixed(3)}, {value.lng.toFixed(3)})</span></span> : <span className="text-muted">No location chosen yet</span>}
      </p>
      {error && <p role="alert" className="text-xs font-medium text-oxblood">{error}</p>}
    </div>
  );
}
