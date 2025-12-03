import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import { useTheme } from "@/core/theme";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { RaceEvent } from "@/utils/eventsUtils";
import { LatLng } from "@/utils/gridUtils";
import * as icons from "@/core/constants/icons";

const Run = () => {
  const { colors, borderRadius } = useTheme();
  const router = useRouter();
  const { event: eventParam } = useLocalSearchParams<{
    event: string;
  }>();

  const mapRef = useRef<MapView | null>(null);

  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completedCheckpoints, setCompletedCheckpoints] = useState(0);

  // Parse the event from params
  const event = useMemo<RaceEvent | null>(() => {
    if (!eventParam) return null;
    try {
      return JSON.parse(eventParam) as RaceEvent;
    } catch {
      return null;
    }
  }, [eventParam]);

  // Calculate average pace (min/km)
  const averagePace = useMemo(() => {
    if (!isRunning || elapsedTime === 0 || !event?.distance) return "--:--";

    // Assuming distance covered is proportional to time for now
    // In a real app, you'd calculate actual distance covered
    const distanceCovered = (elapsedTime / 3600) * 10; // Rough estimate: 10 km/h average
    if (distanceCovered === 0) return "--:--";

    const paceInSeconds = elapsedTime / distanceCovered;
    const paceMinutes = Math.floor(paceInSeconds / 60);
    const paceSeconds = Math.floor(paceInSeconds % 60);

    return `${paceMinutes}:${paceSeconds.toString().padStart(2, "0")}`;
  }, [elapsedTime, isRunning, event?.distance]);

  // Get route coordinates from event
  const routeCoordinates = useMemo(() => {
    if (!event) return [];

    if (event.route?.coordinates && event.route.coordinates.length > 0) {
      return event.route.coordinates;
    }

    // Fallback to checkpoint coordinates
    return event.checkpoints.map((cp) => ({
      latitude: cp.latitude,
      longitude: cp.longitude,
    }));
  }, [event]);

  // Track user location
  const locationState = useLocationTracking((position) => {
    setCurrentPosition(position);

    if (!region) {
      setRegion({
        latitude: position.latitude,
        longitude: position.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  });

  // Center map on event when loaded
  useEffect(() => {
    if (event && event.checkpoints.length > 0 && !region) {
      const startCheckpoint =
        event.checkpoints.find((cp) => cp.id === event.startCheckpointId) ??
        event.checkpoints[0];

      setRegion({
        latitude: startCheckpoint.latitude,
        longitude: startCheckpoint.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  }, [event, region]);

  // Timer for elapsed time
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

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
    setIsRunning(true);
    setElapsedTime(0);
    setCompletedCheckpoints(0);
  };

  const handleStopRun = () => {
    setIsRunning(false);
    // TODO: Submit run results to API
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
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}

        {/* Checkpoints */}
        {event.checkpoints.map((checkpoint, index) => {
          const isStart = checkpoint.id === event.startCheckpointId;
          const isEnd = checkpoint.id === event.endCheckpointId;

          return (
            <Marker
              key={checkpoint.id}
              coordinate={{
                latitude: checkpoint.latitude,
                longitude: checkpoint.longitude,
              }}
              title={checkpoint.title ?? `Checkpoint ${index + 1}`}
              description={
                isStart ? "Start" : isEnd ? "Finish" : `Checkpoint ${index + 1}`
              }
              pinColor={isStart ? "green" : isEnd ? "red" : colors.primary}
            />
          );
        })}
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
            onPress={() => router.back()}
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
            paddingBottom: 40,
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
              {isRunning ? "Running..." : "Ready to start"}
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
                {event.distance?.toFixed(1) ?? "--"}
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
                {completedCheckpoints}/{event.checkpoints.length}
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
          <TouchableOpacity
            style={{
              backgroundColor: isRunning ? colors.error : colors.primary,
              paddingVertical: 18,
              borderRadius: borderRadius.large,
              alignItems: "center",
            }}
            onPress={isRunning ? handleStopRun : handleStartRun}
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
        </View>
      </SafeAreaView>
    </View>
  );
};

export default Run;
