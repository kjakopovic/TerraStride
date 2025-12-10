import type { LatLng } from "@/utils/gridUtils";

export type TerritoryApiRecord = {
  square_key: string;
  color: string;
  average_pace?: string | null;
  left_top_corner_lat: string;
  left_top_corner_lng: string;
  right_top_corner_lat: string;
  right_top_corner_lng: string;
  right_bottom_corner_lat: string;
  right_bottom_corner_lng: string;
  left_bottom_corner_lat: string;
  left_bottom_corner_lng: string;
};

export type TerritoryFeature = {
  id: string;
  color: string;
  averagePace: number | null;
  polygon: LatLng[];
};

export type TerritoriesResponse = {
  status: string;
  message: string;
  territories: TerritoryApiRecord[];
};
