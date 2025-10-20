import { useEffect, useState } from "react";
import { RaceEvent, buildEventPath } from "@/utils/eventsUtils";
import { EventRoute, fetchEventRoute } from "@/utils/directionsUtils";

export const useEventDirections = (
  events: RaceEvent[],
  apiKey: string,
  setRoutingError: React.Dispatch<React.SetStateAction<string | null>>
) => {
  const [eventRoutes, setEventRoutes] = useState<Record<string, EventRoute>>(
    {}
  );

  useEffect(() => {
    if (!apiKey) {
      setRoutingError("Missing Google Directions API key.");
      return;
    }

    let cancelled = false;

    const fetchRoutes = async () => {
      const missing = events.filter((event) => !eventRoutes[event.id]);
      if (!missing.length) return;

      try {
        const entries = await Promise.all(
          missing.map(async (event) => {
            try {
              const route = await fetchEventRoute(event, apiKey);
              return [event.id, route] as const;
            } catch (error) {
              console.warn(`Failed to fetch route for ${event.name}`, error);
              return [
                event.id,
                { polyline: "", coordinates: buildEventPath(event) },
              ] as const;
            }
          })
        );

        if (!cancelled) {
          setEventRoutes((prev) => ({
            ...prev,
            ...Object.fromEntries(entries),
          }));
        }
      } catch {
        if (!cancelled) {
          setRoutingError("Unable to load event directions.");
        }
      }
    };

    fetchRoutes();

    return () => {
      cancelled = true;
    };
  }, [events, apiKey, eventRoutes, setRoutingError]);

  return { eventRoutes, setEventRoutes };
};
