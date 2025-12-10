import { RaceEvent } from "./eventsUtils";

export type DistanceInfo = {
  distance: number; // in meters
  distanceText: string;
};

export const fetchEventDistance = async (
  event: RaceEvent,
  apiKey: string
): Promise<DistanceInfo | null> => {
  if (event.checkpoints.length < 2) return null;

  const start = event.checkpoints[0];
  const end = event.checkpoints[event.checkpoints.length - 1];

  const origin = `${start.latitude},${start.longitude}`;
  const destination = `${end.latitude},${end.longitude}`;

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const json = await response.json();

    if (json.status !== "OK" || !json.rows[0]?.elements[0]) {
      throw new Error(
        `Distance Matrix API error: ${json.status} - ${
          json.error_message ?? "Unknown error"
        }`
      );
    }

    const element = json.rows[0].elements[0];
    if (element.status !== "OK") {
      return null;
    }

    return {
      distance: element.distance.value,
      distanceText: element.distance.text,
    };
  } catch (error) {
    console.error("Failed to fetch event distance:", error);
    throw error;
  }
};
