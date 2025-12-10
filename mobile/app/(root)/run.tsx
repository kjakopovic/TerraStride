import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import { useTheme } from "@/core/theme";
import { RaceEvent, RaceCheckpoint } from "@/utils/eventsUtils";
import { LatLng } from "@/utils/gridUtils";
import * as icons from "@/core/constants/icons";
import { Pedometer } from "expo-sensors";
import * as Location from "expo-location";
import { log } from "@/utils/logger";

// Constants
const CHECKPOINT_RADIUS_METERS = 30;
const LOCATION_UPDATE_INTERVAL_MS = 3000; // Update every 3 seconds
const LOCATION_UPDATE_DISTANCE_M = 5; // Update every 5 meters

type RunState = "idle" | "ready" | "running" | "finished";

type CheckpointStatus = {
  checkpoint: RaceCheckpoint;
  reached: boolean;
  reachedAt: number | null;
  isStart: boolean;
  isEnd: boolean;
};

type RunStats = {
  distanceMeters: number;
  durationSeconds: number;
  steps: number;
  averagePaceSecondsPerKm: number | null;
  positions: LatLng[];
};

// Calculate distance between two coordinates in meters using Haversine formula
const calculateDistanceMeters = (from: LatLng, to: LatLng): number => {
  const R = 6371000;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Check if position is within radius of a checkpoint
const isNearCheckpoint = (
  position: LatLng,
  checkpoint: RaceCheckpoint,
  radiusMeters: number
): boolean => {
  const distance = calculateDistanceMeters(position, {
    latitude: checkpoint.latitude,
    longitude: checkpoint.longitude,
  });
  return distance <= radiusMeters;
};

const Run = () => {
  const { colors, borderRadius } = useTheme();
  const router = useRouter();
  const { event: eventParam } = useLocalSearchParams<{
    event: string;
  }>();

  const mapRef = useRef<MapView | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastPositionRef = useRef<LatLng | null>(null);
  const pedometerSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null
  );

  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [checkpointStatuses, setCheckpointStatuses] = useState<
    CheckpointStatus[]
  >([]);
  const [runStats, setRunStats] = useState<RunStats>({
    distanceMeters: 0,
    durationSeconds: 0,
    steps: 0,
    averagePaceSecondsPerKm: null,
    positions: [],
  });
  const [runnerPath, setRunnerPath] = useState<LatLng[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Parse the event from params
  const event = useMemo<RaceEvent | null>(() => {
    if (!eventParam) return null;
    try {
      return JSON.parse(eventParam) as RaceEvent;
    } catch {
      return null;
    }
  }, [eventParam]);

  // Initialize checkpoint statuses when event loads
  useEffect(() => {
    if (event && checkpointStatuses.length === 0) {
      const statuses: CheckpointStatus[] = event.checkpoints.map((cp) => ({
        checkpoint: cp,
        reached: false,
        reachedAt: null,
        isStart: cp.id === event.startCheckpointId,
        isEnd: cp.id === event.endCheckpointId,
      }));
      setCheckpointStatuses(statuses);
    }
  }, [event, checkpointStatuses.length]);

  // Get start and end checkpoints
  const startCheckpoint = useMemo(() => {
    return checkpointStatuses.find((cs) => cs.isStart);
  }, [checkpointStatuses]);

  const endCheckpoint = useMemo(() => {
    return checkpointStatuses.find((cs) => cs.isEnd);
  }, [checkpointStatuses]);

  // Check if near start checkpoint
  const isNearStart = useMemo(() => {
    if (!currentPosition || !startCheckpoint) return false;
    return isNearCheckpoint(
      currentPosition,
      startCheckpoint.checkpoint,
      CHECKPOINT_RADIUS_METERS
    );
  }, [currentPosition, startCheckpoint]);

  // Calculate completed checkpoints
  const completedCheckpoints = useMemo(() => {
    return checkpointStatuses.filter((cs) => cs.reached).length;
  }, [checkpointStatuses]);

  // Calculate average pace (min/km)
  const averagePace = useMemo(() => {
    if (runStats.distanceMeters < 100 || elapsedTime === 0) return "--:--";

    const distanceKm = runStats.distanceMeters / 1000;
    const paceSecondsPerKm = elapsedTime / distanceKm;
    const paceMinutes = Math.floor(paceSecondsPerKm / 60);
    const paceSeconds = Math.floor(paceSecondsPerKm % 60);

    return `${paceMinutes}:${paceSeconds.toString().padStart(2, "0")}`;
  }, [elapsedTime, runStats.distanceMeters]);

  // Get route coordinates from event
  const routeCoordinates = useMemo(() => {
    if (!event) return [];

    if (event.route?.coordinates && event.route.coordinates.length > 0) {
      return event.route.coordinates;
    }

    return event.checkpoints.map((cp) => ({
      latitude: cp.latitude,
      longitude: cp.longitude,
    }));
  }, [event]);

  // Handle position updates - local only, no API calls
  const handlePositionUpdate = useCallback(
    (position: LatLng) => {
      setCurrentPosition(position);

      if (!region) {
        setRegion({
          latitude: position.latitude,
          longitude: position.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }

      // Update run state based on proximity to start
      if (runState === "idle" && startCheckpoint) {
        const nearStart = isNearCheckpoint(
          position,
          startCheckpoint.checkpoint,
          CHECKPOINT_RADIUS_METERS
        );
        if (nearStart) {
          setRunState("ready");
        }
      }

      // Track distance and path during run
      if (runState === "running") {
        setRunnerPath((prev) => [...prev, position]);

        if (lastPositionRef.current) {
          const distance = calculateDistanceMeters(
            lastPositionRef.current,
            position
          );
          if (distance < 100 && distance > 1) {
            setRunStats((prev) => ({
              ...prev,
              distanceMeters: prev.distanceMeters + distance,
              positions: [...prev.positions, position],
            }));
          }
        }
        lastPositionRef.current = position;

        // Check for checkpoint completion
        setCheckpointStatuses((prev) => {
          let updated = false;
          const newStatuses = prev.map((cs) => {
            if (cs.reached) return cs;

            const isNear = isNearCheckpoint(
              position,
              cs.checkpoint,
              CHECKPOINT_RADIUS_METERS
            );

            if (isNear) {
              updated = true;
              return {
                ...cs,
                reached: true,
                reachedAt: Date.now(),
              };
            }
            return cs;
          });

          return updated ? newStatuses : prev;
        });
      }
    },
    [runState, startCheckpoint, region]
  );

  // Check if run should auto-finish
  useEffect(() => {
    if (runState !== "running" || !endCheckpoint || !currentPosition) return;

    const nearEnd = isNearCheckpoint(
      currentPosition,
      endCheckpoint.checkpoint,
      CHECKPOINT_RADIUS_METERS
    );

    if (nearEnd) {
      const allOthersCompleted = checkpointStatuses.every(
        (cs) => cs.reached || cs.isEnd
      );
      if (allOthersCompleted) {
        handleFinishRun();
      }
    }
  }, [currentPosition, runState, endCheckpoint, checkpointStatuses]);

  // Initialize location tracking - standalone, no useLocationTracking hook
  useEffect(() => {
    let isMounted = true;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          const msg = "Location permission denied";
          setLocationError(msg);
          log("Run: Location permission denied");
          return;
        }

        // Get initial position
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          const position: LatLng = {
            latitude: initialLocation.coords.latitude,
            longitude: initialLocation.coords.longitude,
          };
          handlePositionUpdate(position);
        }

        // Start watching position
        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: LOCATION_UPDATE_INTERVAL_MS,
            distanceInterval: LOCATION_UPDATE_DISTANCE_M,
          },
          (location) => {
            if (isMounted) {
              const position: LatLng = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              };
              handlePositionUpdate(position);
            }
          }
        );
      } catch (error: any) {
        console.warn("Failed to start location tracking:", error);
        log("Run: Failed to start location tracking", { error: error.message });
        if (isMounted) {
          setLocationError("Failed to get location");
        }
      }
    };

    startLocationTracking();

    return () => {
      isMounted = false;
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update handlePositionUpdate ref when dependencies change
  useEffect(() => {
    if (!locationSubscriptionRef.current || runState === "finished") return;

    // Restart location watching with updated callback
    const updateLocationWatching = async () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL_MS,
          distanceInterval: LOCATION_UPDATE_DISTANCE_M,
        },
        (location) => {
          const position: LatLng = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          handlePositionUpdate(position);
        }
      );
    };

    updateLocationWatching();
  }, [runState, handlePositionUpdate]);

  // Center map on event when loaded
  useEffect(() => {
    if (event && event.checkpoints.length > 0 && !region) {
      const start =
        event.checkpoints.find((cp) => cp.id === event.startCheckpointId) ??
        event.checkpoints[0];

      setRegion({
        latitude: start.latitude,
        longitude: start.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  }, [event, region]);

  // Timer for elapsed time
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (runState === "running") {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [runState]);

  // Pedometer tracking
  useEffect(() => {
    if (runState === "running") {
      const startPedometer = async () => {
        const isAvailable = await Pedometer.isAvailableAsync();
        if (isAvailable) {
          pedometerSubscriptionRef.current = Pedometer.watchStepCount(
            (result) => {
              setRunStats((prev) => ({
                ...prev,
                steps: result.steps,
              }));
            }
          );
        }
      };
      startPedometer();
    }

    return () => {
      if (pedometerSubscriptionRef.current) {
        pedometerSubscriptionRef.current.remove();
        pedometerSubscriptionRef.current = null;
      }
    };
  }, [runState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
      if (pedometerSubscriptionRef.current) {
        pedometerSubscriptionRef.current.remove();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRun = () => {
    if (!isNearStart) {
      Alert.alert(
        "Not at Start",
        "You must be near the start checkpoint to begin the race.",
        [{ text: "OK" }]
      );
      return;
    }

    setCheckpointStatuses((prev) =>
      prev.map((cs) =>
        cs.isStart ? { ...cs, reached: true, reachedAt: Date.now() } : cs
      )
    );

    setRunState("running");
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    lastPositionRef.current = currentPosition;
    setRunnerPath(currentPosition ? [currentPosition] : []);
    setRunStats({
      distanceMeters: 0,
      durationSeconds: 0,
      steps: 0,
      averagePaceSecondsPerKm: null,
      positions: currentPosition ? [currentPosition] : [],
    });
  };

  const handleFinishRun = useCallback(() => {
    setRunState("finished");

    // Stop location tracking during run
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }

    // Stop pedometer
    if (pedometerSubscriptionRef.current) {
      pedometerSubscriptionRef.current.remove();
      pedometerSubscriptionRef.current = null;
    }

    setRunStats((prev) => {
      const finalStats: RunStats = {
        ...prev,
        durationSeconds: elapsedTime,
        averagePaceSecondsPerKm:
          prev.distanceMeters > 0
            ? elapsedTime / (prev.distanceMeters / 1000)
            : null,
      };

      const distanceKm = (finalStats.distanceMeters / 1000).toFixed(2);
      const allCheckpointsReached = checkpointStatuses.every(
        (cs) => cs.reached
      );

      setTimeout(() => {
        Alert.alert(
          "Run Complete! 🎉",
          `Time: ${formatTime(elapsedTime)}\n` +
            `Distance: ${distanceKm} km\n` +
            `Steps: ${finalStats.steps}\n` +
            `Checkpoints: ${completedCheckpoints}/${checkpointStatuses.length}\n` +
            `${
              allCheckpointsReached
                ? "All checkpoints reached!"
                : "Some checkpoints missed"
            }`,
          [
            {
              text: "View Results",
              onPress: () => {
                // TODO: Navigate to results screen or submit to API
              },
            },
            {
              text: "Back to Map",
              onPress: () => router.back(),
            },
          ]
        );
      }, 100);

      return finalStats;
    });
  }, [elapsedTime, checkpointStatuses, completedCheckpoints, router]);

  const handleStopRun = () => {
    Alert.alert(
      "Stop Run?",
      "Are you sure you want to stop the run? Your progress will be saved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: () => {
            handleFinishRun();
          },
        },
      ]
    );
  };

  const handleCenterOnUser = () => {
    if (currentPosition && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const getCheckpointColor = (status: CheckpointStatus): string => {
    if (status.isStart) return status.reached ? colors.success : "green";
    if (status.isEnd) return status.reached ? colors.success : "red";
    return status.reached ? colors.success : colors.primary;
  };

  if (!event) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: colors.error,
            fontFamily: "LeagueSpartan-Regular",
            fontSize: 16,
            marginBottom: 16,
          }}
        >
          Event not found
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: borderRadius.large,
          }}
          onPress={() => router.back()}
        >
          <Text
            style={{
              color: colors.background,
              fontFamily: "LeagueSpartan-Bold",
            }}
          >
            Go Back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (locationError) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: colors.error,
            fontFamily: "LeagueSpartan-Regular",
            fontSize: 16,
            marginBottom: 16,
          }}
        >
          {locationError}
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: borderRadius.large,
          }}
          onPress={() => router.back()}
        >
          <Text
            style={{
              color: colors.background,
              fontFamily: "LeagueSpartan-Bold",
            }}
          >
            Go Back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!region) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={{
            color: colors.text40,
            marginTop: 12,
            fontFamily: "LeagueSpartan-Regular",
          }}
        >
          Loading map...
        </Text>
      </SafeAreaView>
    );
  }

  const isRunning = runState === "running";
  const isFinished = runState === "finished";
  const canStart = runState === "ready" || (runState === "idle" && isNearStart);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={(node) => {
          mapRef.current = node;
        }}
        style={{ flex: 1 }}
        region={region}
        showsUserLocation
        followsUserLocation={isRunning}
      >
        {/* Event Route */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.text40}
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}

        {/* Runner's actual path */}
        {runnerPath.length > 1 && (
          <Polyline
            coordinates={runnerPath}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}

        {/* Checkpoints */}
        {checkpointStatuses.map((status, index) => (
          <Marker
            key={status.checkpoint.id}
            coordinate={{
              latitude: status.checkpoint.latitude,
              longitude: status.checkpoint.longitude,
            }}
            title={status.checkpoint.title ?? `Checkpoint ${index + 1}`}
            description={
              status.isStart
                ? "Start"
                : status.isEnd
                ? "Finish"
                : `Checkpoint ${index + 1}`
            }
            pinColor={getCheckpointColor(status)}
          />
        ))}
      </MapView>

      {/* Header */}
      <SafeAreaView
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
        }}
        edges={["top"]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            gap: 12,
          }}
        >
          <TouchableOpacity
            style={{
              height: 44,
              width: 44,
              borderRadius: borderRadius.full,
              backgroundColor: colors.background,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.text,
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
            onPress={() => {
              if (isRunning) {
                handleStopRun();
              } else {
                router.back();
              }
            }}
          >
            <Image
              source={icons.leftArrow}
              style={{ height: 14, width: 16, tintColor: colors.text }}
            />
          </TouchableOpacity>

          <View
            style={{
              flex: 1,
              backgroundColor: colors.background,
              borderRadius: borderRadius.large,
              paddingHorizontal: 16,
              paddingVertical: 12,
              shadowColor: colors.text,
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: "LeagueSpartan-Bold",
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {event.name}
            </Text>
            {event.city && (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "LeagueSpartan-Regular",
                  color: colors.text40,
                }}
              >
                📍 {event.city}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={{
              height: 44,
              width: 44,
              borderRadius: borderRadius.full,
              backgroundColor: colors.background,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.text,
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
            onPress={handleCenterOnUser}
          >
            <Image
              source={icons.figureRun}
              style={{ height: 20, width: 20, tintColor: colors.primary }}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Status Banner */}
      {!isRunning && !isFinished && (
        <View
          style={{
            position: "absolute",
            top: 120,
            left: 16,
            right: 16,
            backgroundColor: isNearStart ? colors.success : colors.warning,
            borderRadius: borderRadius.large,
            padding: 12,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: colors.background,
              fontFamily: "LeagueSpartan-Bold",
              fontSize: 14,
            }}
          >
            {isNearStart
              ? "✓ You're at the start! Ready to begin."
              : "⚠ Move to the start checkpoint to begin"}
          </Text>
        </View>
      )}

      {/* Bottom Panel */}
      <SafeAreaView
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
        }}
        edges={[]}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: borderRadius.xlarge,
            borderTopRightRadius: borderRadius.xlarge,
            padding: 24,
            paddingBottom: 64,
            shadowColor: colors.text,
            shadowOpacity: 0.15,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -4 },
          }}
        >
          {/* Timer */}
          <View
            style={{
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                fontSize: 48,
                fontFamily: "LeagueSpartan-Bold",
                color: colors.text,
              }}
            >
              {formatTime(elapsedTime)}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "LeagueSpartan-Regular",
                color: colors.text40,
              }}
            >
              {isRunning
                ? "Running..."
                : isFinished
                ? "Run complete!"
                : canStart
                ? "Ready to start"
                : "Move to start"}
            </Text>
          </View>

          {/* Stats Row */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              marginBottom: 20,
            }}
          >
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: "LeagueSpartan-Bold",
                  color: colors.text,
                }}
              >
                {(runStats.distanceMeters / 1000).toFixed(2)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "LeagueSpartan-Regular",
                  color: colors.text40,
                }}
              >
                km
              </Text>
            </View>

            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: "LeagueSpartan-Bold",
                  color: colors.text,
                }}
              >
                {averagePace}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "LeagueSpartan-Regular",
                  color: colors.text40,
                }}
              >
                avg pace
              </Text>
            </View>

            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: "LeagueSpartan-Bold",
                  color: colors.text,
                }}
              >
                {runStats.steps}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "LeagueSpartan-Regular",
                  color: colors.text40,
                }}
              >
                steps
              </Text>
            </View>

            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: "LeagueSpartan-Bold",
                  color: colors.text,
                }}
              >
                {completedCheckpoints}/{checkpointStatuses.length}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "LeagueSpartan-Regular",
                  color: colors.text40,
                }}
              >
                checkpoints
              </Text>
            </View>
          </View>

          {/* Start/Stop Button */}
          {!isFinished && (
            <TouchableOpacity
              style={{
                backgroundColor: isRunning
                  ? colors.error
                  : canStart
                  ? colors.primary
                  : colors.text40,
                paddingVertical: 18,
                borderRadius: borderRadius.large,
                alignItems: "center",
              }}
              onPress={isRunning ? handleStopRun : handleStartRun}
              disabled={!isRunning && !canStart}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "LeagueSpartan-Bold",
                  color: colors.background,
                }}
              >
                {isRunning ? "Stop Run" : "Start Run"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Finished State - Back Button */}
          {isFinished && (
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 18,
                borderRadius: borderRadius.large,
                alignItems: "center",
              }}
              onPress={() => router.back()}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "LeagueSpartan-Bold",
                  color: colors.background,
                }}
              >
                Back to Map
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

export default Run;
