import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import MapView, { Polyline, Polygon, Region } from "react-native-maps";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useTheme } from "@/core/theme";
import { useAuth } from "@/hooks/useAuth";
import { useTerritories } from "@/hooks/useTerritories";
import { createApiClient } from "@/utils/apiWrapper";
import {
  GridSquare,
  LatLng,
  createRegionFromPosition,
  gridSquareToPolygon,
  latLngToGridSquare,
} from "@/utils/gridUtils";
import * as icons from "@/core/constants/icons";

const LOCATION_UPDATE_INTERVAL_MS = 3000;
const LOCATION_UPDATE_DISTANCE_M = 5;

const hexToRgba = (hexColor: string, alpha = 0.3) => {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) return hexColor;

  const numeric = Number.parseInt(normalized, 16);
  const r = (numeric >> 16) & 255;
  const g = (numeric >> 8) & 255;
  const b = numeric & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

type CapturedSquareData = {
  square: GridSquare;
  distanceMeters: number;
  durationSeconds: number;
  lastEnterTime: number;
};

const TerritoryCapture = () => {
  const { colors, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getTokens } = useAuth();
  const mapRef = useRef<MapView | null>(null);

  // Refs for tracking run state without re-renders
  const isRunningRef = useRef(false);
  const lastPositionRef = useRef<LatLng | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const capturedSquaresRef = useRef<Map<string, CapturedSquareData>>(new Map());
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null
  );
  const initialPositionSetRef = useRef(false);

  // State
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [initialPosition, setInitialPosition] = useState<LatLng | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [capturedSquaresDisplay, setCapturedSquaresDisplay] = useState<
    GridSquare[]
  >([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch existing territories once
  const { territories, loading: territoriesLoading } =
    useTerritories(initialPosition);

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

  const handlePositionUpdate = useCallback((position: LatLng) => {
    const now = Date.now();
    setCurrentPosition(position);

    if (!initialPositionSetRef.current) {
      initialPositionSetRef.current = true;
      setInitialPosition(position);
      setRegion(createRegionFromPosition(position));
    }

    if (isRunningRef.current) {
      // Calculate distance
      let dist = 0;
      if (lastPositionRef.current) {
        dist = calculateDistanceMeters(lastPositionRef.current, position);
        // Filter GPS jumps
        if (dist > 0 && dist < 100) {
          setTotalDistance((prev) => prev + dist);
        } else {
          dist = 0;
        }
      }

      // Calculate time delta
      const timeDelta =
        lastUpdateTimeRef.current > 0
          ? (now - lastUpdateTimeRef.current) / 1000
          : 0;

      // Identify grid square
      const square = latLngToGridSquare(position.latitude, position.longitude);

      // Update captured squares data
      const currentData = capturedSquaresRef.current.get(square.id) ?? {
        square,
        distanceMeters: 0,
        durationSeconds: 0,
        lastEnterTime: now,
      };

      currentData.distanceMeters += dist;
      currentData.durationSeconds += timeDelta;
      currentData.lastEnterTime = now;

      capturedSquaresRef.current.set(square.id, currentData);

      // Update display (convert map values to array)
      setCapturedSquaresDisplay(
        Array.from(capturedSquaresRef.current.values()).map((d) => d.square)
      );

      lastPositionRef.current = position;
      lastUpdateTimeRef.current = now;
    }
  }, []);

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission denied");
        return;
      }

      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const position: LatLng = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
      };
      handlePositionUpdate(position);

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL_MS,
          distanceInterval: LOCATION_UPDATE_DISTANCE_M,
        },
        (location) => {
          const pos: LatLng = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          handlePositionUpdate(pos);
        }
      );
    } catch (error) {
      console.warn("Failed to start location tracking:", error);
      setLocationError("Failed to get location");
    }
  };

  useEffect(() => {
    startLocationTracking();
    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
    };
  }, [handlePositionUpdate]);

  // Timer
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

  const handleStartRun = () => {
    setIsRunning(true);
    isRunningRef.current = true;
    setElapsedTime(0);
    setTotalDistance(0);
    capturedSquaresRef.current.clear();
    setCapturedSquaresDisplay([]);
    lastPositionRef.current = currentPosition;
    lastUpdateTimeRef.current = Date.now();
  };

  const handleStopRun = () => {
    Alert.alert(
      "Finish Run?",
      "Are you sure you want to finish and claim territories?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Finish",
          style: "default",
          onPress: submitRun,
        },
      ]
    );
  };

  const submitRun = async () => {
    setIsRunning(false);
    isRunningRef.current = false;
    setIsSubmitting(true);

    try {
      const territoriesPayload = Array.from(
        capturedSquaresRef.current.values()
      ).map((data) => {
        const polygon = gridSquareToPolygon(data.square);
        // polygon is [TL, TR, BR, BL, TL]
        const lats = polygon.map((p) => p.latitude);
        const lngs = polygon.map((p) => p.longitude);

        const maxLat = Math.max(...lats);
        const minLat = Math.min(...lats);
        const maxLng = Math.max(...lngs);
        const minLng = Math.min(...lngs);

        // Calculate pace
        const distanceKm = data.distanceMeters / 1000;
        let paceStr = "0.00";
        if (distanceKm > 0) {
          const paceSecondsPerKm = data.durationSeconds / distanceKm;
          const paceMin = Math.floor(paceSecondsPerKm / 60);
          const paceSec = Math.floor(paceSecondsPerKm % 60);
          paceStr = `${paceMin}.${paceSec.toString().padStart(2, "0")}`;
        }

        // Generate a random color for now
        const colorsList = [
          "#ff9900",
          "#33cc33",
          "#0066ff",
          "#cc0000",
          "#ff66cc",
          "#0099cc",
        ];
        const randomColor =
          colorsList[Math.floor(Math.random() * colorsList.length)];

        return {
          average_pace: paceStr,
          left_top_corner_lat: maxLat,
          left_top_corner_lng: minLng,
          left_bottom_corner_lat: minLat,
          left_bottom_corner_lng: minLng,
          right_top_corner_lat: maxLat,
          right_top_corner_lng: maxLng,
          right_bottom_corner_lat: minLat,
          right_bottom_corner_lng: maxLng,
          color: randomColor,
        };
      });

      if (territoriesPayload.length === 0) {
        Alert.alert(
          "No Territory",
          "You didn't cover enough distance to capture any territory."
        );
        setIsSubmitting(false);
        return;
      }

      const usersApiBaseUrl =
        process.env.EXPO_PUBLIC_API_BASE_URL_TERRITORIES ?? "";
      const client = createApiClient({ baseUrl: usersApiBaseUrl, getTokens });

      // Assuming the wrapper expects { body: ... } or { data: ... } in the config object
      await client.post("", { body: { territories: territoriesPayload } });

      Alert.alert("Success", "Territories captured successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error("Failed to submit territories:", error);
      Alert.alert("Error", "Failed to submit run. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (locationError) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <Text style={{ color: colors.text, marginBottom: 16 }}>
          {locationError}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setLocationError(null);
            startLocationTracking();
          }}
          style={{
            backgroundColor: colors.primary,
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: borderRadius.medium,
          }}
        >
          <Text style={{ color: "#fff" }}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  } else if (!initialPosition) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 16 }}>
          Acquiring location...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <MapView
        ref={(ref) => {
          mapRef.current = ref;
        }}
        style={{ flex: 1 }}
        initialRegion={region!}
        showsUserLocation={true}
        followsUserLocation={true}
      >
        {/* Render existing territories */}
        {!territoriesLoading &&
          territories.map((territory) => (
            <Polygon
              key={territory.id}
              coordinates={territory.polygon}
              fillColor={hexToRgba(territory.color, 0.3)}
              strokeColor={territory.color}
              strokeWidth={2}
            />
          ))}

        {/* Render captured squares */}
        {capturedSquaresDisplay.map((square) => {
          const polygon = gridSquareToPolygon(square);
          return (
            <Polygon
              key={square.id}
              coordinates={polygon}
              fillColor={hexToRgba("#00cc00", 0.4)}
              strokeColor={"#00cc00"}
              strokeWidth={2}
            />
          );
        })}
      </MapView>

      {/* UI Overlay */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 16,
          left: 16,
          right: 16,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: hexToRgba(colors.background, 0.8),
          padding: 12,
          borderRadius: borderRadius.medium,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginRight: 12,
            padding: 4,
          }}
        >
          <Image
            source={icons.leftArrow}
            style={{ width: 20, height: 20, tintColor: colors.text }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text
          style={{
            color: colors.text,
            fontSize: 16,
            fontWeight: "bold",
            flex: 1,
            textAlign: "center",
          }}
        >
          Time: {formatTime(elapsedTime)} | Distance:{" "}
          {(totalDistance / 1000).toFixed(2)} km
        </Text>

        {/* Spacer to balance the layout */}
        <View style={{ width: 24 }} />
      </View>

      <View
        style={{
          position: "absolute",
          bottom: 32,
          left: 16,
          right: 16,
          flexDirection: "row",
          justifyContent: "center",
        }}
      >
        {!isRunning ? (
          <TouchableOpacity
            onPress={handleStartRun}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 12,
              paddingHorizontal: 32,
              borderRadius: borderRadius.medium,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
              Start Run
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleStopRun}
            disabled={isSubmitting}
            style={{
              backgroundColor: isSubmitting ? colors.text40 : colors.primary,
              paddingVertical: 12,
              paddingHorizontal: 32,
              borderRadius: borderRadius.medium,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>
                Stop & Claim
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </>
  );
};

export default TerritoryCapture;
