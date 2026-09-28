import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { latLngBounds, type LatLngExpression } from "leaflet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listActiveLocations, type FutaLocation } from "@/services/locations";
import { getDrivingRoute, type DrivingRoute } from "@/services/routing";

const FUTA_CENTER: LatLngExpression = [7.299, 5.141];
const PICKUP_COLOR = "#b28b00";
const DESTINATION_COLOR = "#087f8c";
const DEFAULT_MARKER_COLOR = "#3388ff";

function hasValidCoordinates(
  location: FutaLocation | undefined,
): location is FutaLocation & { latitude: number; longitude: number } {
  return location?.latitude !== null
    && location?.latitude !== undefined
    && location.longitude !== null
    && location.longitude !== undefined
    && Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && location.longitude >= -180
    && location.longitude <= 180;
}

function RouteLayer({ route }: { route: DrivingRoute }) {
  const map = useMap();
  const coordinates = route.geometry.coordinates;

  useEffect(() => {
    const bounds = latLngBounds(coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
  }, [coordinates, map]);

  const positions = coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
  return <Polyline positions={positions} pathOptions={{ color: DESTINATION_COLOR, weight: 5, opacity: 0.85 }} />;
}

interface FutaMapProps {
  originLocationId?: string | null;
  destinationLocationId?: string | null;
  onOriginChange?: (locationId: string) => void;
  onDestinationChange?: (locationId: string) => void;
  onRouteEstimateChange?: (estimate: string | null) => void;
  locations?: FutaLocation[];
  locationsLoading?: boolean;
}

export function FutaMap({
  originLocationId,
  destinationLocationId,
  onOriginChange,
  onDestinationChange,
  onRouteEstimateChange,
  locations: providedLocations,
  locationsLoading,
}: FutaMapProps) {
  const [fetchedLocations, setFetchedLocations] = useState<FutaLocation[]>([]);
  const [fetchingLocations, setFetchingLocations] = useState(providedLocations === undefined);
  const [internalOriginId, setInternalOriginId] = useState<string | null>(null);
  const [internalDestinationId, setInternalDestinationId] = useState<string | null>(null);
  const [route, setRoute] = useState<DrivingRoute | null>(null);
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "ready" | "no-route" | "invalid-location" | "error">("idle");
  const locations = providedLocations ?? fetchedLocations;
  const isLoadingLocations = locationsLoading ?? fetchingLocations;

  const selectedOriginId = originLocationId === undefined ? internalOriginId : originLocationId;
  const selectedDestinationId = destinationLocationId === undefined ? internalDestinationId : destinationLocationId;

  const changeOrigin = (locationId: string) => {
    if (originLocationId === undefined) setInternalOriginId(locationId);
    onRouteEstimateChange?.(null);
    onOriginChange?.(locationId);
  };

  const changeDestination = (locationId: string) => {
    if (destinationLocationId === undefined) setInternalDestinationId(locationId);
    onRouteEstimateChange?.(null);
    onDestinationChange?.(locationId);
  };

  useEffect(() => {
    if (providedLocations !== undefined) {
      setFetchingLocations(false);
      return;
    }

    let mounted = true;

    void listActiveLocations().then((data) => {
      if (mounted) {
        setFetchedLocations(data);
        setFetchingLocations(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [providedLocations]);

  const mappedLocations = locations.filter(hasValidCoordinates);
  const origin = locations.find((location) => location.id === selectedOriginId);
  const destination = locations.find((location) => location.id === selectedDestinationId);

  useEffect(() => {
    if (!selectedOriginId || !selectedDestinationId) {
      setRoute(null);
      setRouteStatus("idle");
      return;
    }
    if (!hasValidCoordinates(origin) || !hasValidCoordinates(destination)) {
      setRoute(null);
      setRouteStatus("invalid-location");
      return;
    }

    const controller = new AbortController();
    setRoute(null);
    setRouteStatus("loading");

    void getDrivingRoute(
      { latitude: origin.latitude!, longitude: origin.longitude! },
      { latitude: destination.latitude!, longitude: destination.longitude! },
      controller.signal,
    ).then((nextRoute) => {
      if (controller.signal.aborted) return;
      setRoute(nextRoute);
      setRouteStatus(nextRoute ? "ready" : "no-route");
    }).catch(() => {
      if (controller.signal.aborted) return;
      setRoute(null);
      setRouteStatus("error");
    });

    return () => controller.abort();
  }, [origin, destination, selectedOriginId, selectedDestinationId]);

  const routeSummary = route ? `Driving estimate · ${route.distance < 1000 ? `${Math.round(route.distance)} m` : `${(route.distance / 1000).toFixed(1)} km`} · about ${Math.max(1, Math.round(route.duration / 60))} min` : null;

  useEffect(() => {
    onRouteEstimateChange?.(routeStatus === "ready" ? routeSummary : null);
  }, [onRouteEstimateChange, routeStatus, routeSummary]);

  return (
    <div className="surface-panel mt-6 overflow-hidden">
      <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="futa-map-pickup">Pickup</Label>
          <Select value={selectedOriginId ?? ""} onValueChange={changeOrigin}>
            <SelectTrigger id="futa-map-pickup" aria-label="Pickup location" disabled={isLoadingLocations}>
              <SelectValue placeholder={isLoadingLocations ? "Loading locations…" : "Choose a pickup location"} />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="futa-map-destination">Destination</Label>
          <Select value={selectedDestinationId ?? ""} onValueChange={changeDestination}>
            <SelectTrigger id="futa-map-destination" aria-label="Destination location" disabled={isLoadingLocations}>
              <SelectValue placeholder={isLoadingLocations ? "Loading locations…" : "Choose a destination"} />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground sm:col-span-2" aria-label="Map selection legend">
          <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: PICKUP_COLOR }} />Pickup</span>
          <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: DESTINATION_COLOR }} />Destination</span>
        </div>
        <p className="text-sm text-muted-foreground sm:col-span-2" aria-live="polite">
          {routeStatus === "loading" && "Finding a driving route…"}
          {routeStatus === "ready" && routeSummary}
          {routeStatus === "no-route" && "No driving route was found for these locations."}
          {routeStatus === "invalid-location" && "A selected location has no valid map coordinates."}
          {routeStatus === "error" && "The route could not be loaded. Please try again."}
        </p>
      </div>
      <div className="h-[360px] w-full">
        <MapContainer
          center={FUTA_CENTER}
          zoom={15}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {route && <RouteLayer route={route} />}

          {mappedLocations.map((location) => (
            <CircleMarker
              key={location.id}
              center={[location.latitude!, location.longitude!]}
              radius={location.id === selectedOriginId || location.id === selectedDestinationId ? 9 : 7}
              pathOptions={{
                color: location.id === selectedOriginId ? PICKUP_COLOR : location.id === selectedDestinationId ? DESTINATION_COLOR : DEFAULT_MARKER_COLOR,
                fillColor: location.id === selectedDestinationId ? DESTINATION_COLOR : location.id === selectedOriginId ? PICKUP_COLOR : DEFAULT_MARKER_COLOR,
                fillOpacity: location.id === selectedOriginId || location.id === selectedDestinationId ? 1 : 0.65,
                weight: location.id === selectedOriginId || location.id === selectedDestinationId ? 3 : 2,
              }}
            >
              <Popup>
                <strong>{location.name}</strong>
                <br />
                {location.category}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
