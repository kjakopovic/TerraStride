import { LatLng } from "./gridUtils";

export type EventRoute = {
  polyline: string;
  coordinates: LatLng[];
};

export type RaceCheckpoint = LatLng & { id: string; title?: string };
export type RaceEvent = {
  id: string;
  name: string;
  checkpoints: RaceCheckpoint[];
  isCircuit: boolean;
  startCheckpointId: string;
  endCheckpointId: string;
  raceDate?: string;
  raceTime?: string;
  city: string;
  entryFee: number;
  route?: EventRoute;
  distance?: number;
  isDistributed: boolean;
};

export const buildEventPath = (event: RaceEvent): LatLng[] => {
  if (event.checkpoints.length === 0) return [];
  const path = event.checkpoints.map(({ latitude, longitude }) => ({
    latitude,
    longitude,
  }));
  if (event.isCircuit && path.length > 1) {
    path.push(path[0]);
  }
  return path;
};

export const reorderCheckpointsForEvent = ({
  checkpoints,
  isCircuit,
  startCheckpointId,
  endCheckpointId,
}: {
  checkpoints: RaceCheckpoint[];
  isCircuit?: boolean;
  startCheckpointId?: string | null;
  endCheckpointId?: string | null;
}): RaceCheckpoint[] => {
  if (!checkpoints.length || !startCheckpointId) return checkpoints;

  const startIndex = checkpoints.findIndex((cp) => cp.id === startCheckpointId);
  if (startIndex < 0) return checkpoints;

  if (isCircuit) {
    return [
      ...checkpoints.slice(startIndex),
      ...checkpoints.slice(0, startIndex),
    ];
  }

  if (!endCheckpointId) return checkpoints;

  const endIndex = checkpoints.findIndex((cp) => cp.id === endCheckpointId);
  if (endIndex < 0) return checkpoints;

  const start = checkpoints[startIndex];
  const end = checkpoints[endIndex];
  const middle = checkpoints.filter(
    (cp, idx) => idx !== startIndex && idx !== endIndex
  );

  return [start, ...middle, end];
};
