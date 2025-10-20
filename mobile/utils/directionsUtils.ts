import { LatLng } from "./gridUtils";
import { RaceCheckpoint, RaceEvent } from "./eventsUtils";

export type EventRoute = {
  polyline: string;
  coordinates: LatLng[];
};

const GOOGLE_DIRECTIONS_URL =
  "https://maps.googleapis.com/maps/api/directions/json";

const decodePolyline = (polyline: string): LatLng[] => {
  let index = 0;
  const len = polyline.length;
  const coords: LatLng[] = [];
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coords.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coords;
};

const checkpointToParam = ({ latitude, longitude }: RaceCheckpoint) =>
  `${latitude},${longitude}`;

export const fetchEventRoute = async (
  event: RaceEvent,
  apiKey: string
): Promise<EventRoute> => {
  console.log("Fetching route for event:", event.name);
  if (!event.checkpoints.length) {
    return { polyline: "", coordinates: [] };
  }

  const checkpoints = event.isCircuit
    ? [...event.checkpoints, event.checkpoints[0]]
    : event.checkpoints;

  if (checkpoints.length === 1) {
    return {
      polyline: "",
      coordinates: [
        {
          latitude: checkpoints[0].latitude,
          longitude: checkpoints[0].longitude,
        },
      ],
    };
  }

  const origin = checkpoints[0];
  const destination = checkpoints[checkpoints.length - 1];
  const waypoints = checkpoints.slice(1, -1);

  const params = new URLSearchParams({
    origin: checkpointToParam(origin),
    destination: checkpointToParam(destination),
    key: apiKey,
    mode: "walking",
  });

  if (waypoints.length) {
    params.append("waypoints", waypoints.map(checkpointToParam).join("|"));
  }

  const response = await fetch(`${GOOGLE_DIRECTIONS_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Google Directions error: ${response.status}`);
  }

  const data = await response.json();

  const polyline = data.routes?.[0]?.overview_polyline?.points;
  if (!polyline) {
    throw new Error("No route returned by Google Directions");
  }

  return {
    polyline,
    coordinates: decodePolyline(polyline),
  };
};
