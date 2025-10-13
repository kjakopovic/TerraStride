import * as Location from "expo-location";
import { LatLng } from "./gridUtils";

export type LocationHandler = (coords: LatLng) => void;
export type PermissionDeniedHandler = () => void;

const OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 4000,
  distanceInterval: 15,
};

export const startForegroundLocationTracking = async (
  onLocation: LocationHandler,
  onPermissionDenied?: PermissionDeniedHandler
): Promise<Location.LocationSubscription | null> => {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== Location.PermissionStatus.GRANTED) {
    onPermissionDenied?.();
    return null;
  }

  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest,
  });

  onLocation({
    latitude: current.coords.latitude,
    longitude: current.coords.longitude,
  });

  return Location.watchPositionAsync(OPTIONS, ({ coords }) =>
    onLocation({ latitude: coords.latitude, longitude: coords.longitude })
  );
};
