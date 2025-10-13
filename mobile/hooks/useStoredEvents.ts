import { useEffect, useState } from "react";
import { RaceEvent, reorderCheckpointsForEvent } from "@/utils/eventsUtils";
import { loadStoredEvents } from "@/utils/eventsStorage";

export const useStoredEvents = () => {
  const [events, setEvents] = useState<RaceEvent[]>([]);

  useEffect(() => {
    (async () => {
      const stored = await loadStoredEvents();
      if (stored.length) {
        setEvents(
          stored.map((event) => ({
            ...event,
            checkpoints: reorderCheckpointsForEvent(event),
          }))
        );
      }
    })();
  }, []);

  return { events, setEvents };
};
