import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
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
import { RaceEvent, buildEventPath } from "@/utils/eventsUtils";
import { EventRoute, fetchEventRoute } from "@/utils/directionsUtils";
import { fetchEventDistance } from "@/utils/distanceUtils";
import { useRouter } from "expo-router";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { useEvents } from "@/hooks/useEvents";
import { useTickets } from "@/hooks/useTickets";
import { useAuth } from "@/hooks/useAuth";
import MapSearchBar from "@/components/map/SearchBar";
import MapSearchResults from "@/components/map/SearchResults";
import MapRoutingWarning from "@/components/map/RoutingWarning";
import MapFabMenu from "@/components/map/FabMenu";
import EventDetailsModal from "@/components/map/EventDetailsModal";
import EventBuilderModal from "@/components/events/EventBuilderModal";
import { useTerritories } from "@/hooks/useTerritories";
import type {
  CreateEventPayload,
  EventBuilderResult,
} from "@/core/types/event";

const hexToRgba = (hexColor: string, alpha = 0.3) => {
  const normalized = hexColor.replace("#", "");
  if (normalized.length !== 6) return hexColor;

  const numeric = Number.parseInt(normalized, 16);
  const r = (numeric >> 16) & 255;
  const g = (numeric >> 8) & 255;
  const b = numeric & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const Map = () => {
  const { colors } = useTheme();
  const directionsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const lastEventsQueryRef = useRef<string | null>(null);
  const ticketsFetchedRef = useRef(false);
  const { getTokens } = useAuth();

  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [currentSquare, setCurrentSquare] = useState<GridSquare | null>(null);
  const [neighborSquares, setNeighborSquares] = useState<GridSquare[]>([]);

  const {
    events,
    createEvent,
    refresh: refreshEvents,
    getEvents,
    loading: eventsLoading,
    error: eventsError,
  } = useEvents();

  const {
    purchaseTicket,
    hasTicketForEvent,
    fetchTickets,
    consumeTicket,
    getTicketForEvent,
  } = useTickets(getTokens);

  const [eventRoutes, setEventRoutes] = useState<Record<string, EventRoute>>(
    {}
  );
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);

  const {
    territories,
    loading: territoriesLoading,
    error: territoriesError,
  } = useTerritories(currentPosition);

  const [currentView, setCurrentView] = useState<"territory" | "events">(
    "territory"
  );
  const [fabOpen, setFabOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<RaceEvent | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const isEventActive = useMemo(() => {
    if (!selectedEvent?.raceDate || !selectedEvent?.raceTime) return false;

    try {
      const eventDateTime = new Date(
        `${selectedEvent.raceDate}T${selectedEvent.raceTime}:00`
      );
      const now = new Date();
      const eventEndTime = new Date(
        eventDateTime.getTime() + 24 * 60 * 60 * 1000
      );

      return now >= eventDateTime && now <= eventEndTime;
    } catch {
      return false;
    }
  }, [selectedEvent?.raceDate, selectedEvent?.raceTime]);

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

  useEffect(() => {
    if (currentView !== "events" || !currentPosition) return;

    const queryKey = `${currentPosition.latitude.toFixed(
      5
    )}-${currentPosition.longitude.toFixed(5)}`;
    if (queryKey === lastEventsQueryRef.current) return;

    lastEventsQueryRef.current = queryKey;

    getEvents(currentPosition).catch((error) => {
      console.warn("Failed to fetch events", error);
    });
  }, [currentView, currentPosition, getEvents]);

  // Fetch tickets on mount
  useEffect(() => {
    if (ticketsFetchedRef.current) return;
    ticketsFetchedRef.current = true;

    fetchTickets().catch((err) => {
      console.warn("Failed to fetch tickets:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConsumeTicket = async (event: RaceEvent | null) => {
    if (!event) return;

    const ticket = getTicketForEvent(event.id);
    if (!ticket) {
      Alert.alert("No Ticket", "You don't have a ticket for this event.");
      return;
    }

    if (ticket.is_used) {
      Alert.alert("Already Used", "This ticket has already been used.");
      return;
    }

    try {
      await consumeTicket(ticket.id);
      setDetailsVisible(false);
      setSelectedEvent(null);

      Alert.alert(
        "Ticket Verified",
        `Your ticket for ${event.name} has been verified. Ready to start your run?`,
        [
          {
            text: "Later",
            style: "cancel",
          },
          {
            text: "Start Run",
            style: "default",
            onPress: () => {
              router.push({
                pathname: "/run",
                params: {
                  event: JSON.stringify(event),
                },
              });
            },
          },
        ]
      );
    } catch (error: any) {
      const message =
        error?.payload?.message ??
        error?.message ??
        "Failed to consume ticket. Please try again.";
      Alert.alert("Error", message);
    }
  };

  const handlePurchaseTicket = async (event: RaceEvent | null) => {
    if (!event) return;

    if (!event.isDistributed) {
      Alert.alert(
        "Tickets Unavailable",
        "Tickets for this event are not yet available for purchase."
      );
      return;
    }

    if (hasTicketForEvent(event.id)) {
      Alert.alert(
        "Already Purchased",
        "You already have a ticket for this event."
      );
      return;
    }

    try {
      await purchaseTicket(event.id);
      Alert.alert(
        "Success",
        `You have successfully purchased a ticket for ${event.name}.`
      );
      setDetailsVisible(false);
      setSelectedEvent(null);
    } catch (error: any) {
      const message =
        error?.payload?.message ??
        error?.message ??
        "Failed to purchase ticket. Please try again.";
      Alert.alert("Error", message);
    }
  };

  const handleEventCreated = async (draft: EventBuilderResult) => {
    let route: EventRoute | undefined;
    let distance: number | undefined;

    const baseEvent = {
      id: draft.id,
      name: draft.name,
      checkpoints: draft.checkpoints,
      isCircuit: draft.isCircuit,
      startCheckpointId: draft.startCheckpointId,
      endCheckpointId: draft.endCheckpointId,
      raceDate: draft.raceDate,
      raceTime: draft.raceTime,
    } as RaceEvent;

    if (directionsApiKey) {
      try {
        route = await fetchEventRoute(baseEvent, directionsApiKey);
        const distanceInfo = await fetchEventDistance(
          baseEvent,
          directionsApiKey
        );
        distance = distanceInfo?.distance
          ? distanceInfo.distance / 1000
          : undefined;
        setRoutingError(null);
      } catch (error) {
        console.warn("Failed to fetch Google Directions or Distance", error);
        setRoutingError(
          "Saved event with fallback path (Directions/Distance unavailable)."
        );
      }
    } else {
      setRoutingError("Missing Google Directions API key.");
    }

    const orderedEvent: RaceEvent = {
      ...baseEvent,
      checkpoints: draft.checkpoints,
      route,
      city: draft.city,
      entryFee: draft.entryFee,
    };

    const routeCoordinates =
      route?.coordinates?.length && route.coordinates.length > 0
        ? route.coordinates
        : buildEventPath(orderedEvent);

    const payload: CreateEventPayload = {
      name: draft.name,
      city: draft.city,
      entry_fee: draft.entryFee,
      date: draft.raceDate,
      startTime: draft.raceTime,
      km_long: distance,
      checkpoints: draft.checkpoints.map((checkpoint) => ({
        address: checkpoint.title ?? "Checkpoint",
        lat: checkpoint.latitude,
        lng: checkpoint.longitude,
        is_start: checkpoint.id === draft.startCheckpointId,
        is_end: checkpoint.id === draft.endCheckpointId,
      })),
      trace: routeCoordinates.map(({ latitude, longitude }) => ({
        lat: latitude,
        lng: longitude,
      })),
    };

    try {
      await createEvent(payload);
    } catch (error: any) {
      const message =
        error?.payload?.message ??
        error?.message ??
        "Failed to create event. Please try again.";
      setRoutingError(message);
      return;
    }

    if (route) {
      setEventRoutes((prev) => ({
        ...prev,
        [orderedEvent.id]: route!,
      }));
    }

    if (currentPosition) {
      try {
        await refreshEvents(currentPosition);
        lastEventsQueryRef.current = `${currentPosition.latitude.toFixed(
          5
        )}-${currentPosition.longitude.toFixed(5)}`;
      } catch (error) {
        console.warn("Failed to refresh events after creation", error);
      }
    }

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

  const territoryReady = currentView !== "territory" || !territoriesLoading;

  const eventsReady =
    currentView !== "events" || !eventsLoading || events.length > 0;

  const showBlockingSpinner =
    locationState.loading || !mapReady || (!territoryReady && !eventsReady);

  if (showBlockingSpinner) {
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
            {territories.map((territory) => (
              <Polygon
                key={`territory-${territory.id}`}
                coordinates={territory.polygon}
                strokeColor={territory.color}
                strokeWidth={2}
                fillColor={hexToRgba(territory.color, 0.25)}
              />
            ))}

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

      {(currentView === "territory" &&
        territoriesLoading &&
        !territories.length) ||
      (currentView === "events" && eventsLoading && !events.length) ? (
        <View
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}

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

      <MapRoutingWarning
        message={routingError ?? territoriesError ?? eventsError}
      />

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
        isPurchaseAvailable={isEventActive || false}
        onPurchaseTicket={() => handlePurchaseTicket(selectedEvent)}
        hasTicket={selectedEvent ? hasTicketForEvent(selectedEvent.id) : false}
        onConsumeTicket={() => handleConsumeTicket(selectedEvent)}
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
