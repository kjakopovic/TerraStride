import AsyncStorage from "@react-native-async-storage/async-storage";
import { RaceEvent } from "./eventsUtils";

const EVENTS_KEY = "terraStride.events";

export const loadStoredEvents = async (): Promise<RaceEvent[]> => {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    return raw ? (JSON.parse(raw) as RaceEvent[]) : [];
  } catch (error) {
    console.warn("[eventsStorage] load failed", error);
    return [];
  }
};

export const saveStoredEvents = async (events: RaceEvent[]) => {
  try {
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch (error) {
    console.warn("[eventsStorage] save failed", error);
  }
};

export const appendStoredEvent = async (event: RaceEvent) => {
  const existing = await loadStoredEvents();
  await saveStoredEvents([...existing, event]);
};
