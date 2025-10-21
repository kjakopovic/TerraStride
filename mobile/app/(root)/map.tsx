import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Text, View } from "react-native";
import MapView, { Marker, Polygon, Polyline, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/core/theme";
import {
  GridSquare,
  LatLng,
  createRegionFromPosition,
  gridIndicesToSquare,
  gridSquareToPolygon,
  latLngToGridSquare,
} from "@/utils/gridUtils";
import {
  RaceEvent,
  buildEventPath,
  reorderCheckpointsForEvent,
} from "@/utils/eventsUtils";
import { EventRoute, fetchEventRoute } from "@/utils/directionsUtils";
import { appendStoredEvent } from "@/utils/eventsStorage";
import * as icons from "@/core/constants/icons";
import { useRouter } from "expo-router";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { useStoredEvents } from "@/hooks/useStoredEvents";
import MapSearchBar from "@/components/map/SearchBar";
import MapSearchResults from "@/components/map/SearchResults";
import MapRoutingWarning from "@/components/map/RoutingWarning";
import MapFabMenu from "@/components/map/FabMenu";
import EventDetailsModal from "@/components/map/EventDetailsModal";
import EventBuilderModal from "@/components/events/EventBuilderModal";

const Map = () => {
  const { colors } = useTheme();
  const directionsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);

  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [currentSquare, setCurrentSquare] = useState<GridSquare | null>(null);
  const [neighborSquares, setNeighborSquares] = useState<GridSquare[]>([]);
  const claimedIdsRef = useRef<Set<string>>(new Set());

  const { events, setEvents } = useStoredEvents();
  const [eventRoutes, setEventRoutes] = useState<Record<string, EventRoute>>(
    {}
  );
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<"territory" | "events">(
    "territory"
  );
  const [fabOpen, setFabOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<RaceEvent | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const locationState = useLocationTracking((position) => {
    setCurrentPosition(position);
    setRegion(createRegionFromPosition(position));

    const square = latLngToGridSquare(position.latitude, position.longitude);
    setCurrentSquare(square);

    const [gridX, gridY] = square.id.split("_").map(Number);
    if (Number.isFinite(gridX) && Number.isFinite(gridY)) {
      const neighbors: GridSquare[] = [];
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          neighbors.push(gridIndicesToSquare(gridX + dx, gridY + dy));
        }
      }
      setNeighborSquares(neighbors);
    } else {
      setNeighborSquares([]);
    }
  });

  const mapReady = useMemo(() => !!region, [region]);

  useEffect(() => {
    if (!events.length) return;
    setEventRoutes((prev) => {
      const next = { ...prev };
      events.forEach((event) => {
        if (event.route) {
          next[event.id] = event.route;
        }
      });
      return next;
    });
  }, [events]);

  const handleEventCreated = async (event: RaceEvent) => {
    let route: EventRoute | undefined;

    if (directionsApiKey) {
      try {
        route = await fetchEventRoute(event, directionsApiKey);
        setRoutingError(null);
      } catch (error) {
        console.warn("Failed to fetch Google Directions", error);
        setRoutingError(
          "Saved event with fallback path (Directions unavailable)."
        );
      }
    } else {
      setRoutingError("Missing Google Directions API key.");
    }

    const ordered = reorderCheckpointsForEvent(event);
    const nextEvent: RaceEvent = {
      ...event,
      checkpoints: ordered,
      startCheckpointId: ordered[0]?.id,
      endCheckpointId: event.isCircuit
        ? ordered[0]?.id
        : ordered[ordered.length - 1]?.id,
      raceDate: event.raceDate,
      raceTime: event.raceTime,
      route,
    };

    if (route) {
      setEventRoutes((prev) => ({
        ...prev,
        [nextEvent.id]: route,
      }));
    }

    setEvents((prev) => {
      const next = [...prev, nextEvent];
      appendStoredEvent(nextEvent);
      return next;
    });

    setEventModalVisible(false);
  };

  const handleSearchSelect = (event: RaceEvent) => {
    setSearchQuery(event.name);
    setSelectedEvent(event);
    setDetailsVisible(true);
    setCurrentView("events");

    const startCheckpoint = event.checkpoints[0];
    if (startCheckpoint && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: startCheckpoint.latitude,
          longitude: startCheckpoint.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500
      );
    }
  };

  const openEventDetails = useCallback((event: RaceEvent) => {
    setSelectedEvent(event);
    setDetailsVisible(true);

    const startCheckpoint = event.checkpoints[0];
    if (startCheckpoint && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: startCheckpoint.latitude,
          longitude: startCheckpoint.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        400
      );
    }
  }, []);

  if (locationState.loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (locationState.permissionDenied) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center" }}>
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={{ color: colors.text, textAlign: "center" }}>
            Location permission is required to claim territories.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!mapReady) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
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
        region={region!}
        showsUserLocation
      >
        {currentView === "territory" && (
          <>
            {neighborSquares.map((square) => (
              <Polygon
                key={`neighbor-${square.id}`}
                coordinates={gridSquareToPolygon(square)}
                strokeColor="rgba(0, 150, 255, 0.6)"
                strokeWidth={2}
                fillColor="transparent"
              />
            ))}

            {currentSquare && (
              <Polygon
                coordinates={gridSquareToPolygon(currentSquare)}
                fillColor="rgba(0, 150, 255, 0.3)"
                strokeColor="rgba(0, 150, 255, 0.9)"
                strokeWidth={2}
              />
            )}
          </>
        )}

        {currentView === "events" &&
          events.map((event) => {
            const cachedRoute = eventRoutes[event.id] ?? event.route ?? null;
            const routeCoordinates =
              cachedRoute?.coordinates ?? buildEventPath(event);

            return (
              <React.Fragment key={event.id}>
                {routeCoordinates.length > 1 && (
                  <Polyline
                    coordinates={routeCoordinates}
                    strokeWidth={5}
                    strokeColor={colors.primary}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}
                {event.checkpoints.map((checkpoint) => (
                  <Marker
                    key={checkpoint.id}
                    coordinate={checkpoint}
                    pinColor={
                      selectedEvent?.id === event.id &&
                      selectedEvent.startCheckpointId === checkpoint.id
                        ? colors.success
                        : colors.primary
                    }
                    title={event.name}
                    description={checkpoint.title}
                    onPress={() => openEventDetails(event)}
                  />
                ))}
              </React.Fragment>
            );
          })}
      </MapView>

      <MapSearchBar
        searchQuery={searchQuery}
        onChange={(text) => {
          setSearchQuery(text);
        }}
        onBack={router.back}
      />

      <MapSearchResults
        visible={searchQuery.trim().length > 0}
        query={searchQuery}
        events={events}
        onSelect={handleSearchSelect}
      />

      <MapRoutingWarning message={routingError} />

      <MapFabMenu
        open={fabOpen}
        toggle={() => setFabOpen((prev) => !prev)}
        onAction={(idx) => {
          setFabOpen(false);
          if (idx === 0) setCurrentView("territory");
          if (idx === 1) setCurrentView("events");
          if (idx === 2) setEventModalVisible(true);
        }}
      />

      <EventDetailsModal
        event={selectedEvent}
        visible={detailsVisible}
        onClose={() => {
          setDetailsVisible(false);
          setSelectedEvent(null);
        }}
      />

      <EventBuilderModal
        visible={eventModalVisible}
        onClose={() => setEventModalVisible(false)}
        onConfirm={handleEventCreated}
      />
    </View>
  );
};

export default Map;
