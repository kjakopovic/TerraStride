import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { createApiClient } from "@/utils/apiWrapper";
import type {
  TerritoryApiRecord,
  TerritoryFeature,
  TerritoriesResponse,
} from "@/core/types/territory";
import type { LatLng } from "@/utils/gridUtils";

const mapTerritoryRecord = (
  record: TerritoryApiRecord
): TerritoryFeature | null => {
  const parse = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const topLat = parse(record.left_top_corner_lat);
  const topLng = parse(record.left_top_corner_lng);
  const rightTopLat = parse(record.right_top_corner_lat);
  const rightTopLng = parse(record.right_top_corner_lng);
  const rightBottomLat = parse(record.right_bottom_corner_lat);
  const rightBottomLng = parse(record.right_bottom_corner_lng);
  const leftBottomLat = parse(record.left_bottom_corner_lat);
  const leftBottomLng = parse(record.left_bottom_corner_lng);

  if (
    topLat === null ||
    topLng === null ||
    rightTopLat === null ||
    rightTopLng === null ||
    rightBottomLat === null ||
    rightBottomLng === null ||
    leftBottomLat === null ||
    leftBottomLng === null
  ) {
    return null;
  }

  const polygon: LatLng[] = [
    { latitude: topLat, longitude: topLng },
    { latitude: rightTopLat, longitude: rightTopLng },
    { latitude: rightBottomLat, longitude: rightBottomLng },
    { latitude: leftBottomLat, longitude: leftBottomLng },
    { latitude: topLat, longitude: topLng },
  ];

  const averagePaceValue = Number.parseFloat(record.average_pace ?? "");

  return {
    id: record.square_key,
    color: record.color ?? "#0066ff",
    averagePace: Number.isFinite(averagePaceValue) ? averagePaceValue : null,
    polygon,
  };
};

export const useTerritories = (coords: LatLng | null) => {
  const usersApiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL_TERRITORIES ?? "";
  const { getTokens } = useAuth();

  const [territories, setTerritories] = useState<TerritoryFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastQueryRef = useRef<string | null>(null);

  const fetchTerritories = useCallback(
    async (
      shouldUpdate: () => boolean = () => true,
      position: LatLng | null
    ) => {
      if (!usersApiBaseUrl) {
        if (shouldUpdate()) setError("Missing user API base URL.");
        return;
      }

      if (!position) {
        if (shouldUpdate()) setTerritories([]);
        return;
      }

      const queryKey = `${position.latitude.toFixed(
        5
      )}-${position.longitude.toFixed(5)}`;
      if (queryKey === lastQueryRef.current) return;
      lastQueryRef.current = queryKey;

      const apiClient = createApiClient({
        baseUrl: usersApiBaseUrl,
        getTokens,
      });

      if (shouldUpdate()) setLoading(true);

      try {
        const response = await apiClient.get<TerritoriesResponse>("", {
          query: {
            lat: position.latitude,
            lng: position.longitude,
          },
        });

        const mapped = response.territories
          .map(mapTerritoryRecord)
          .filter(
            (territory): territory is TerritoryFeature => territory !== null
          );

        if (shouldUpdate()) {
          setTerritories(mapped);
          setError(null);
        }
      } catch (err: any) {
        if (shouldUpdate()) {
          const message =
            err?.payload?.message ??
            err?.message ??
            "Failed to load territories.";
          setError(message);
          console.warn("Failed to fetch territories", err);
        }
      } finally {
        if (shouldUpdate()) setLoading(false);
      }
    },
    [getTokens, usersApiBaseUrl]
  );

  useEffect(() => {
    let active = true;

    if (!coords) {
      lastQueryRef.current = null;
      setTerritories([]);
      return;
    }

    fetchTerritories(() => active, coords);

    return () => {
      active = false;
    };
  }, [coords, fetchTerritories]);

  const refresh = useCallback(
    () => fetchTerritories(() => true, coords),
    [fetchTerritories, coords]
  );

  return {
    territories,
    loading,
    error,
    refresh,
  };
};
