import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/core/theme";
import { useRouter } from "expo-router";
import { useEvents } from "@/hooks/useEvents";
import { RaceEvent } from "@/utils/eventsUtils";
import * as icons from "@/core/constants/icons";
import * as Location from "expo-location";
import { LatLng } from "@/utils/gridUtils";

const Search = () => {
  const { colors, borderRadius, spacing } = useTheme();
  const router = useRouter();
  const { events, getEvents, loading, error } = useEvents();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<RaceEvent | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const lastFetchRef = useRef<string | null>(null);

  // Get user location on mount
  useEffect(() => {
    let isMounted = true;

    const getUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          setLocationError("Location permission denied");
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (isMounted) {
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (err) {
        console.warn("Failed to get location:", err);
        if (isMounted) {
          setLocationError("Failed to get your location");
        }
      }
    };

    getUserLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch events when location is available or search query changes
  useEffect(() => {
    if (!userLocation) return;

    const fetchKey = `${userLocation.latitude}-${userLocation.longitude}-${debouncedQuery}`;

    // Skip if we've already fetched with these params
    if (lastFetchRef.current === fetchKey) return;
    lastFetchRef.current = fetchKey;

    getEvents(userLocation, {
      force: true,
      search: debouncedQuery || undefined,
    }).catch((err) => {
      console.warn("Failed to fetch events:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, debouncedQuery]);

  const handleEventSelect = (event: RaceEvent) => {
    setSelectedEvent(event);
    setDetailsVisible(true);
  };

  const closeDetails = () => {
    setDetailsVisible(false);
    setSelectedEvent(null);
  };

  const isLoading = loading || (!userLocation && !locationError);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      {/* Header */}
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
            backgroundColor: colors.text10,
            alignItems: "center",
            justifyContent: "center",
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
            height: 44,
            borderRadius: borderRadius.full,
            backgroundColor: colors.text10,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
          }}
        >
          <TextInput
            placeholder="Search events..."
            placeholderTextColor={colors.text40}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              color: colors.text,
              fontFamily: "LeagueSpartan-Regular",
              fontSize: 16,
            }}
            autoFocus
          />
          {loading ? (
            <ActivityIndicator size="small" color={colors.text10} />
          ) : (
            <Image
              source={icons.search}
              style={{ width: 20, height: 20, tintColor: colors.text40 }}
            />
          )}
        </View>
      </View>

      {/* Location Error State */}
      {locationError && (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{
              color: colors.error,
              textAlign: "center",
              fontFamily: "LeagueSpartan-Regular",
              marginBottom: 8,
            }}
          >
            {locationError}
          </Text>
          <Text
            style={{
              color: colors.text40,
              textAlign: "center",
              fontFamily: "LeagueSpartan-Regular",
            }}
          >
            Please enable location services to search for events near you.
          </Text>
        </View>
      )}

      {/* Loading State */}
      {isLoading && !locationError && (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={{
              color: colors.text40,
              marginTop: 12,
              fontFamily: "LeagueSpartan-Regular",
            }}
          >
            {!userLocation ? "Getting your location..." : "Loading events..."}
          </Text>
        </View>
      )}

      {/* API Error State */}
      {error && !isLoading && !locationError && (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{
              color: colors.error,
              textAlign: "center",
              fontFamily: "LeagueSpartan-Regular",
            }}
          >
            {error}
          </Text>
        </View>
      )}

      {/* Events List */}
      {!isLoading && !error && !locationError && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {events.length === 0 ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingTop: 60,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontFamily: "LeagueSpartan-Regular",
                  fontSize: 16,
                }}
              >
                {searchQuery.trim()
                  ? "No events found"
                  : "No events available nearby"}
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.large,
                  padding: 16,
                  marginBottom: 12,
                  shadowColor: colors.text,
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                }}
                onPress={() => handleEventSelect(event)}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: "LeagueSpartan-Bold",
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  {event.name}
                </Text>

                {event.city && (
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "LeagueSpartan-Regular",
                      color: colors.text,
                      marginBottom: 8,
                    }}
                  >
                    📍 {event.city}
                  </Text>
                )}

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    {event.raceDate && (
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "LeagueSpartan-Regular",
                          color: colors.text,
                        }}
                      >
                        📅 {event.raceDate}
                      </Text>
                    )}
                    {event.distance && (
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "LeagueSpartan-Regular",
                          color: colors.text,
                        }}
                      >
                        🏃 {event.distance.toFixed(1)} km
                      </Text>
                    )}
                  </View>

                  <View
                    style={{
                      backgroundColor: colors.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: borderRadius.full,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "LeagueSpartan-Bold",
                        color: colors.background,
                      }}
                    >
                      ${event.entryFee}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Event Details Modal */}
      <Modal
        visible={detailsVisible}
        animationType="slide"
        transparent
        onRequestClose={closeDetails}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: borderRadius.xlarge,
              borderTopRightRadius: borderRadius.xlarge,
              padding: 24,
              maxHeight: "70%",
            }}
          >
            {/* Handle */}
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: colors.text,
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 20,
              }}
            />

            {selectedEvent && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Event Name */}
                <Text
                  style={{
                    fontSize: 24,
                    fontFamily: "LeagueSpartan-Bold",
                    color: colors.text,
                    marginBottom: 8,
                  }}
                >
                  {selectedEvent.name}
                </Text>

                {/* City */}
                {selectedEvent.city && (
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "LeagueSpartan-Regular",
                      color: colors.text,
                      marginBottom: 16,
                    }}
                  >
                    📍 {selectedEvent.city}
                  </Text>
                )}

                {/* Details Grid */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  {selectedEvent.raceDate && (
                    <View
                      style={{
                        backgroundColor: colors.text,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: borderRadius.large,
                        minWidth: "45%",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "LeagueSpartan-Regular",
                          color: colors.text,
                        }}
                      >
                        Date
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          fontFamily: "LeagueSpartan-Bold",
                          color: colors.text,
                        }}
                      >
                        {selectedEvent.raceDate}
                      </Text>
                    </View>
                  )}

                  {selectedEvent.raceTime && (
                    <View
                      style={{
                        backgroundColor: colors.text,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: borderRadius.large,
                        minWidth: "45%",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "LeagueSpartan-Regular",
                          color: colors.text,
                        }}
                      >
                        Start Time
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          fontFamily: "LeagueSpartan-Bold",
                          color: colors.text,
                        }}
                      >
                        {selectedEvent.raceTime}
                      </Text>
                    </View>
                  )}

                  {selectedEvent.distance && (
                    <View
                      style={{
                        backgroundColor: colors.text,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: borderRadius.large,
                        minWidth: "45%",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "LeagueSpartan-Regular",
                          color: colors.text,
                        }}
                      >
                        Distance
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          fontFamily: "LeagueSpartan-Bold",
                          color: colors.text,
                        }}
                      >
                        {selectedEvent.distance.toFixed(1)} km
                      </Text>
                    </View>
                  )}

                  <View
                    style={{
                      backgroundColor: colors.text,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: borderRadius.large,
                      minWidth: "45%",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "LeagueSpartan-Regular",
                        color: colors.text,
                      }}
                    >
                      Entry Fee
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontFamily: "LeagueSpartan-Bold",
                        color: colors.primary,
                      }}
                    >
                      ${selectedEvent.entryFee}
                    </Text>
                  </View>
                </View>

                {/* Checkpoints */}
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: "LeagueSpartan-Bold",
                    color: colors.text,
                    marginBottom: 8,
                  }}
                >
                  Checkpoints ({selectedEvent.checkpoints.length})
                </Text>

                {selectedEvent.checkpoints.map((checkpoint, index) => (
                  <View
                    key={checkpoint.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 8,
                      borderBottomWidth:
                        index < selectedEvent.checkpoints.length - 1 ? 1 : 0,
                      borderBottomColor: colors.text,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor:
                          checkpoint.id === selectedEvent.startCheckpointId
                            ? colors.success
                            : checkpoint.id === selectedEvent.endCheckpointId
                            ? colors.error
                            : colors.primary,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "LeagueSpartan-Bold",
                          color: colors.background,
                        }}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: "LeagueSpartan-Regular",
                        color: colors.text,
                        flex: 1,
                      }}
                    >
                      {checkpoint.title ?? `Checkpoint ${index + 1}`}
                    </Text>
                  </View>
                ))}

                {/* Close Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: borderRadius.large,
                    alignItems: "center",
                    marginTop: 24,
                  }}
                  onPress={closeDetails}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "LeagueSpartan-Bold",
                      color: colors.background,
                    }}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Search;
