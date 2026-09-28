export interface DrivingRoute {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  distance: number;
  duration: number;
}

interface OsrmRouteResponse {
  code: string;
  routes?: DrivingRoute[];
}

export async function getDrivingRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  signal?: AbortSignal,
): Promise<DrivingRoute | null> {
  const coordinates = [origin, destination];
  if (coordinates.some(({ latitude, longitude }) => !Number.isFinite(latitude) || !Number.isFinite(longitude))) {
    throw new Error("Route coordinates are invalid.");
  }

  const coordinatePair = ({ latitude, longitude }: typeof origin) => `${longitude},${latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinatePair(origin)};${coordinatePair(destination)}?overview=full&geometries=geojson`;
  const response = await fetch(url, signal ? { signal } : {});
  if (!response.ok) throw new Error("Route service request failed.");

  const result = (await response.json()) as OsrmRouteResponse;
  if (result.code === "NoRoute" || result.code === "NoSegment") return null;
  if (result.code !== "Ok" || !result.routes?.[0]) {
    throw new Error("Route service returned an invalid response.");
  }

  const route = result.routes[0];
  if (route.geometry.type !== "LineString" || route.geometry.coordinates.length < 2) {
    throw new Error("Route service returned invalid road geometry.");
  }

  return route;
}