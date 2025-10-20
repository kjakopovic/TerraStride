import { useEffect, useState } from "react";
import { LatLng } from "@/utils/gridUtils";
import { startForegroundLocationTracking } from "@/utils/locationUtils";

type LocationState = {
  loading: boolean;
  permissionDenied: boolean;
};

export const useLocationTracking = (
  onLocation: (position: LatLng) => void
): LocationState => {
  const [state, setState] = useState<LocationState>({
    loading: true,
    permissionDenied: false,
  });

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    const run = async () => {
      subscription = await startForegroundLocationTracking(onLocation, () =>
        setState({ loading: false, permissionDenied: true })
      );

      if (subscription) {
        setState({ loading: false, permissionDenied: false });
      }
    };

    run();

    return () => subscription?.remove?.();
  }, [onLocation]);

  return state;
};
