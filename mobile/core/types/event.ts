import type { RaceCheckpoint } from "@/utils/eventsUtils";
import type { LatLng } from "@/utils/gridUtils";

export type EventBuilderResult = {
  id: string;
  name: string;
  city: string;
  entryFee: number;
  raceDate: string;
  raceTime: string;
  isCircuit: boolean;
  startCheckpointId: string;
  endCheckpointId: string;
  checkpoints: RaceCheckpoint[];
};

export type EventCheckpointPayload = {
  address: string;
  lat: number;
  lng: number;
  is_start: boolean;
  is_end: boolean;
};

export type EventTracePoint = {
  lat: number;
  lng: number;
};

export type EventApiRecord = {
  id: string;
  name: string;
  city: string;
  entry_fee: number;
  date: string;
  startTime: string;
  checkpoints: EventCheckpointPayload[];
  trace: EventTracePoint[];
};

export type CreateEventPayload = {
  name: string;
  city: string;
  entry_fee: number;
  date: string;
  startTime: string;
  checkpoints: EventCheckpointPayload[];
  trace: EventTracePoint[];
};

export type CreateEventResponse = {
  status: string;
  message: string;
  eventId?: string;
};

export type EventsQueryResponse = {
  status: string;
  message: string;
  events: EventApiRecord[];
};
