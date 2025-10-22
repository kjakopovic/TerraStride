import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  Platform,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useTheme } from "@/core/theme";
import { LatLng } from "@/utils/gridUtils";
import {
  RaceCheckpoint,
  RaceEvent,
  reorderCheckpointsForEvent,
} from "@/utils/eventsUtils";
import type { EventBuilderResult } from "@/core/types/event";

type EventBuilderModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (event: EventBuilderResult) => void;
  initialRegion?: Region;
};

const DEFAULT_REGION: Region = {
  latitude: 45.3273,
  longitude: 14.441,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const formatDate = (date: Date | null) =>
  date ? date.toISOString().split("T")[0] : "";
const formatTime = (date: Date | null) =>
  date ? date.toISOString().split("T")[1].slice(0, 5) : "";

const EventBuilderModal: React.FC<EventBuilderModalProps> = ({
  visible,
  onClose,
  onConfirm,
  initialRegion,
}) => {
  const { colors, borderRadius } = useTheme();
  const [eventName, setEventName] = useState("");
  const [isCircuit, setIsCircuit] = useState(false);
  const [checkpoints, setCheckpoints] = useState<RaceCheckpoint[]>([]);
  const [label, setLabel] = useState("");
  const [coordinate, setCoordinate] = useState<LatLng>({
    latitude: initialRegion?.latitude ?? DEFAULT_REGION.latitude,
    longitude: initialRegion?.longitude ?? DEFAULT_REGION.longitude,
  });
  const [startCheckpointId, setStartCheckpointId] = useState<string | null>(
    null
  );
  const [endCheckpointId, setEndCheckpointId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [eventTime, setEventTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [tempTime, setTempTime] = useState<Date>(new Date());
  const [city, setCity] = useState("");
  const [entryFee, setEntryFee] = useState("");

  useEffect(() => {
    if (!visible) {
      setEventName("");
      setIsCircuit(false);
      setCheckpoints([]);
      setLabel("");
      setCoordinate({
        latitude: initialRegion?.latitude ?? DEFAULT_REGION.latitude,
        longitude: initialRegion?.longitude ?? DEFAULT_REGION.longitude,
      });
      setStartCheckpointId(null);
      setEndCheckpointId(null);
      setErrorMessage(null);
      setEventDate(null);
      setEventTime(null);
      setShowDatePicker(false);
      setShowTimePicker(false);
      setTempDate(new Date());
      setTempTime(new Date());
      setCity("");
      setEntryFee("");
    }
  }, [visible, initialRegion]);

  const region = useMemo(
    () =>
      initialRegion ?? {
        ...DEFAULT_REGION,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      },
    [initialRegion, coordinate]
  );

  const mapRegion = useMemo(
    () => ({
      ...region,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    }),
    [region, coordinate]
  );

  const addCheckpoint = () => {
    const trimmed = label.trim();
    const newCheckpoint: RaceCheckpoint = {
      id: `${Date.now()}-${Math.random()}`,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      title: trimmed || `Checkpoint ${checkpoints.length + 1}`,
    };

    setCheckpoints((prev) => [...prev, newCheckpoint]);
    setLabel("");
    setCoordinate({
      latitude: initialRegion?.latitude ?? DEFAULT_REGION.latitude,
      longitude: initialRegion?.longitude ?? DEFAULT_REGION.longitude,
    });
    setErrorMessage(null);
  };

  const removeCheckpoint = (id: string) => {
    setCheckpoints((prev) => prev.filter((cp) => cp.id !== id));
    if (startCheckpointId === id) setStartCheckpointId(null);
    if (endCheckpointId === id) setEndCheckpointId(null);
  };

  const canAddCheckpoint = label.trim().length > 0;
  const entryFeeValue = Number.parseFloat(entryFee);
  const isEntryFeeValid =
    !Number.isNaN(entryFeeValue) &&
    Number.isFinite(entryFeeValue) &&
    entryFeeValue >= 0;
  const canSave =
    eventName.trim().length > 0 &&
    city.trim().length > 0 &&
    checkpoints.length >= 2 &&
    startCheckpointId &&
    (isCircuit
      ? true
      : !!endCheckpointId && startCheckpointId !== endCheckpointId) &&
    !!eventDate &&
    !!eventTime &&
    isEntryFeeValid;

  const neutralStroke = "rgba(33, 33, 33, 0.12)";
  const neutralBg = "rgba(255, 255, 255, 0.9)";
  const mutedBg = "rgba(33, 33, 33, 0.05)";
  const disabledBg = "rgba(33, 33, 33, 0.08)";

  const openDatePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: eventDate ?? new Date(),
        mode: "date",
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            setEventDate(selectedDate);
          }
        },
      });
    } else {
      setTempDate(eventDate ?? new Date());
      setShowDatePicker(true);
    }
  };

  const openTimePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: eventTime ?? new Date(),
        mode: "time",
        is24Hour: true,
        onChange: (event, selectedTime) => {
          if (event.type === "set" && selectedTime) {
            setEventTime(selectedTime);
          }
        },
      });
    } else {
      setTempTime(eventTime ?? new Date());
      setShowTimePicker(true);
    }
  };

  const handleDateConfirm = () => {
    setEventDate(tempDate);
    setShowDatePicker(false);
  };

  const handleTimeConfirm = () => {
    setEventTime(tempTime);
    setShowTimePicker(false);
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ padding: 20, gap: 16 }}>
              <Text
                style={{ fontSize: 20, fontWeight: "600", color: colors.text }}
              >
                Create Race Event
              </Text>

              <TextInput
                value={eventName}
                onChangeText={setEventName}
                placeholder="Event name"
                style={{
                  borderWidth: 1,
                  borderColor: neutralStroke,
                  borderRadius: borderRadius.medium,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.text,
                  backgroundColor: neutralBg,
                }}
                placeholderTextColor={colors.text40}
              />
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City"
                style={{
                  borderWidth: 1,
                  borderColor: neutralStroke,
                  borderRadius: borderRadius.medium,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.text,
                  backgroundColor: neutralBg,
                }}
                placeholderTextColor={colors.text40}
              />
              <TextInput
                value={entryFee}
                onChangeText={setEntryFee}
                placeholder="Entry fee"
                keyboardType="decimal-pad"
                style={{
                  borderWidth: 1,
                  borderColor: neutralStroke,
                  borderRadius: borderRadius.medium,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.text,
                  backgroundColor: neutralBg,
                }}
                placeholderTextColor={colors.text40}
              />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  Circuit
                </Text>
                <Switch
                  value={isCircuit}
                  onValueChange={setIsCircuit}
                  thumbColor={isCircuit ? colors.primary : neutralStroke}
                  trackColor={{ false: mutedBg, true: colors.primary70 }}
                />
              </View>

              <View style={{ gap: 10 }}>
                <Text style={{ color: colors.text40, fontSize: 13 }}>
                  Drag the map pin or enter an address/label to position a
                  checkpoint.
                </Text>

                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="Checkpoint label or address"
                  style={{
                    borderWidth: 1,
                    borderColor: neutralStroke,
                    borderRadius: borderRadius.medium,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: colors.text,
                    backgroundColor: neutralBg,
                  }}
                  placeholderTextColor={colors.text40}
                />

                <TouchableOpacity
                  onPress={openDatePicker}
                  style={{
                    borderWidth: 1,
                    borderColor: neutralStroke,
                    borderRadius: borderRadius.medium,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    backgroundColor: neutralBg,
                  }}
                >
                  <Text
                    style={{ color: eventDate ? colors.text : colors.text40 }}
                  >
                    {eventDate ? formatDate(eventDate) : "Select race date"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={openTimePicker}
                  style={{
                    borderWidth: 1,
                    borderColor: neutralStroke,
                    borderRadius: borderRadius.medium,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    backgroundColor: neutralBg,
                  }}
                >
                  <Text
                    style={{ color: eventTime ? colors.text : colors.text40 }}
                  >
                    {eventTime ? formatTime(eventTime) : "Select race time"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    alignSelf: "flex-end",
                    backgroundColor: canAddCheckpoint
                      ? colors.primary
                      : disabledBg,
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    borderRadius: borderRadius.medium,
                  }}
                  disabled={!canAddCheckpoint}
                  onPress={addCheckpoint}
                >
                  <Text
                    style={{
                      color: canAddCheckpoint
                        ? colors.background
                        : colors.text40,
                      fontWeight: "600",
                    }}
                  >
                    Add Checkpoint
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={{
                height: 280,
                marginHorizontal: 20,
                borderRadius: borderRadius.large,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: neutralStroke,
              }}
            >
              <MapView style={{ flex: 1 }} region={mapRegion}>
                {checkpoints.map((checkpoint) => (
                  <Marker
                    key={checkpoint.id}
                    coordinate={{
                      latitude: checkpoint.latitude,
                      longitude: checkpoint.longitude,
                    }}
                    title={checkpoint.title}
                  />
                ))}
                <Marker
                  coordinate={coordinate}
                  draggable
                  onDragEnd={(event) =>
                    setCoordinate(event.nativeEvent.coordinate)
                  }
                  title="New checkpoint"
                />
              </MapView>
            </View>

            <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
              <Text
                style={{ fontWeight: "600", fontSize: 16, color: colors.text }}
              >
                Checkpoints
              </Text>

              <ScrollView contentContainerStyle={{ marginTop: 12, gap: 10 }}>
                {checkpoints.map((checkpoint, index) => (
                  <View
                    key={checkpoint.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 14,
                      borderRadius: borderRadius.medium,
                      backgroundColor: mutedBg,
                    }}
                  >
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                        onPress={() =>
                          setStartCheckpointId(
                            startCheckpointId === checkpoint.id
                              ? null
                              : checkpoint.id
                          )
                        }
                      >
                        <View
                          style={{
                            height: 18,
                            width: 18,
                            borderRadius: 9,
                            borderWidth: 2,
                            borderColor: colors.primary,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {startCheckpointId === checkpoint.id && (
                            <View
                              style={{
                                height: 10,
                                width: 10,
                                borderRadius: 5,
                                backgroundColor: colors.primary,
                              }}
                            />
                          )}
                        </View>
                        <Text style={{ color: colors.text, fontSize: 12 }}>
                          Start
                        </Text>
                      </TouchableOpacity>

                      {!isCircuit && (
                        <TouchableOpacity
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                          onPress={() =>
                            setEndCheckpointId(
                              endCheckpointId === checkpoint.id
                                ? null
                                : checkpoint.id
                            )
                          }
                        >
                          <View
                            style={{
                              height: 18,
                              width: 18,
                              borderRadius: 9,
                              borderWidth: 2,
                              borderColor: colors.text,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {endCheckpointId === checkpoint.id && (
                              <View
                                style={{
                                  height: 10,
                                  width: 10,
                                  borderRadius: 5,
                                  backgroundColor: colors.text,
                                }}
                              />
                            )}
                          </View>
                          <Text style={{ color: colors.text, fontSize: 12 }}>
                            Finish
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => removeCheckpoint(checkpoint.id)}
                    >
                      <Text style={{ color: colors.error, fontWeight: "600" }}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {checkpoints.length === 0 && (
                  <Text style={{ color: colors.text40, fontSize: 13 }}>
                    No checkpoints added yet.
                  </Text>
                )}
              </ScrollView>

              {errorMessage && (
                <Text
                  style={{
                    color: colors.error,
                    fontSize: 13,
                    paddingHorizontal: 20,
                    marginTop: 8,
                  }}
                >
                  {errorMessage}
                </Text>
              )}
              {!isEntryFeeValid && entryFee.trim().length > 0 && (
                <Text
                  style={{
                    color: colors.error,
                    fontSize: 13,
                    paddingHorizontal: 20,
                    marginTop: 4,
                  }}
                >
                  Enter a valid entry fee.
                </Text>
              )}
            </View>

            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 12,
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: borderRadius.medium,
                  backgroundColor: neutralBg,
                  alignItems: "center",
                }}
                onPress={onClose}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: borderRadius.medium,
                  backgroundColor: canSave ? colors.primary : disabledBg,
                  alignItems: "center",
                }}
                disabled={!canSave}
                onPress={() => {
                  if (!startCheckpointId) {
                    setErrorMessage("Select a starting checkpoint.");
                    return;
                  }
                  if (!isCircuit && !endCheckpointId) {
                    setErrorMessage("Select a finishing checkpoint.");
                    return;
                  }
                  if (!isCircuit && startCheckpointId === endCheckpointId) {
                    setErrorMessage(
                      "Start and finish checkpoints must differ."
                    );
                    return;
                  }
                  setErrorMessage(null);

                  const orderedCheckpoints = reorderCheckpointsForEvent({
                    checkpoints,
                    isCircuit,
                    startCheckpointId,
                    endCheckpointId,
                  });

                  const dateString = formatDate(eventDate);
                  const timeString = formatTime(eventTime);

                  const result: EventBuilderResult = {
                    id: `${Date.now()}-${Math.random()}`,
                    name: eventName.trim(),
                    city: city.trim(),
                    entryFee: entryFeeValue,
                    raceDate: dateString,
                    raceTime: timeString,
                    isCircuit,
                    startCheckpointId: orderedCheckpoints[0]!.id,
                    endCheckpointId: isCircuit
                      ? orderedCheckpoints[0]!.id
                      : orderedCheckpoints[orderedCheckpoints.length - 1]!.id,
                    checkpoints: orderedCheckpoints,
                  };

                  onConfirm(result);
                }}
              >
                <Text
                  style={{
                    color: canSave ? colors.background : colors.text40,
                    fontWeight: "600",
                  }}
                >
                  Save Event
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* iOS date picker overlay */}
      {showDatePicker && Platform.OS === "ios" && (
        <Modal transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: colors.background,
                paddingTop: 16,
                paddingBottom: 32,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              }}
            >
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                onChange={(_, selectedDate) => {
                  if (selectedDate) setTempDate(selectedDate);
                }}
              />
              <View
                style={{
                  width: "90%",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                }}
              >
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDateConfirm}>
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* iOS time picker overlay */}
      {showTimePicker && Platform.OS === "ios" && (
        <Modal transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.background,
                paddingTop: 16,
                paddingBottom: 32,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              }}
            >
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={(_, selectedTime) => {
                  if (selectedTime) setTempTime(selectedTime);
                }}
              />
              <View
                style={{
                  width: "90%",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                }}
              >
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={{ color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleTimeConfirm}>
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
};

export default EventBuilderModal;
