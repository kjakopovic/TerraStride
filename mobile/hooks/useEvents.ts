import { useCallback, useMemo, useRef, useState } from "react";
import { createApiClient } from "@/utils/apiWrapper";
import { useAuth } from "./useAuth";
import type {
  RaceEvent,
  RaceCheckpoint,
  EventRoute,
} from "@/utils/eventsUtils";
import type {
  CreateEventPayload,
  CreateEventResponse,
  EventApiRecord,
  EventsQueryResponse,
} from "@/core/types/event";
import type { LatLng } from "@/utils/gridUtils";

const EVENTS_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL_EVENTS ?? "";

const toRaceEvent = (record: EventApiRecord): RaceEvent | null => {
  if (!record.checkpoints?.length) {
    return null;
  }

  const parse = (value: number | string) =>
    typeof value === "number" ? value : Number.parseFloat(value);

  const checkpoints: RaceCheckpoint[] = record.checkpoints.map(
    (checkpoint, index) => ({
      id: `${record.id}-checkpoint-${index}`,
      latitude: parse(checkpoint.lat),
      longitude: parse(checkpoint.lng),
      title: checkpoint.address,
    })
  );

  let startIndex = record.checkpoints.findIndex((cp) => cp.is_start);
  if (startIndex < 0) startIndex = 0;

  let endIndex = record.checkpoints.findIndex((cp) => cp.is_end);
  if (endIndex < 0) endIndex = checkpoints.length - 1;

  const startCheckpointId =
    checkpoints[startIndex]?.id ?? checkpoints[0]?.id ?? "";
  const endCheckpointId =
    checkpoints[endIndex]?.id ?? checkpoints[checkpoints.length - 1]?.id ?? "";

  const tracePoints =
    record.trace?.map(({ lat, lng }) => ({
      latitude: parse(lat),
      longitude: parse(lng),
    })) ?? [];

  const route: EventRoute | undefined =
    tracePoints.length > 1
      ? {
          polyline: "",
          coordinates: tracePoints,
        }
      : undefined;

  return {
    id: record.id,
    name: record.name,
    checkpoints,
    isCircuit: startCheckpointId === endCheckpointId,
    startCheckpointId,
    endCheckpointId,
    raceDate: record.date,
    raceTime: record.startTime,
    city: record.city,
    entryFee: record.entry_fee,
    route,
  };
};

export const useEvents = () => {
  const [events, setEvents] = useState<RaceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getTokens } = useAuth();

  const apiClient = useMemo(() => {
    if (!EVENTS_BASE_URL) return null;
    return createApiClient({
      baseUrl: EVENTS_BASE_URL,
      getTokens,
    });
  }, [getTokens]);

  const lastQueryRef = useRef<string | null>(null);

  const getEvents = useCallback(
    async (coords: LatLng, force = false) => {
      if (!apiClient) {
        throw new Error("Missing events API base URL.");
      }

      const queryKey = `${coords.latitude.toFixed(
        5
      )}-${coords.longitude.toFixed(5)}`;

      if (!force && queryKey === lastQueryRef.current) {
        return events;
      }

      lastQueryRef.current = queryKey;
      setLoading(true);

      try {
        const response = await apiClient.get<EventsQueryResponse>("", {
          query: { lat: coords.latitude, lng: coords.longitude },
        });

        const mapped = response.events
          .map(toRaceEvent)
          .filter((event): event is RaceEvent => event !== null);

        setEvents(mapped);
        setError(null);
        return mapped;
      } catch (err: any) {
        const message =
          err?.payload?.message ?? err?.message ?? "Failed to load events.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, events]
  );

  const refresh = useCallback(
    (coords: LatLng) => getEvents(coords, true),
    [getEvents]
  );

  const createEvent = useCallback(
    async (payload: CreateEventPayload) => {
      if (!apiClient) {
        throw new Error("Missing events API base URL.");
      }

      return apiClient.post<CreateEventResponse>("", {
        body: payload,
      });
    },
    [apiClient]
  );

  return { events, setEvents, createEvent, getEvents, refresh, loading, error };
};
