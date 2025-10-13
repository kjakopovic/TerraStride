import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/core/theme";
import { RaceEvent } from "@/utils/eventsUtils";

type Props = {
  visible: boolean;
  query: string;
  events: RaceEvent[];
  onSelect: (event: RaceEvent) => void;
};

const MapSearchResults: React.FC<Props> = ({
  visible,
  query,
  events,
  onSelect,
}) => {
  const { colors, borderRadius } = useTheme();

  if (!visible || !query.trim()) return null;

  const filtered = events.filter((event) =>
    event.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View
      style={{
        position: "absolute",
        top: 120,
        left: 16,
        right: 16,
        borderRadius: borderRadius.large,
        backgroundColor: colors.background,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        maxHeight: 220,
      }}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        {filtered.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(33,33,33,0.08)",
            }}
            onPress={() => onSelect(event)}
          >
            <Text style={{ color: colors.text, fontWeight: "500" }}>
              {event.name}
            </Text>
            <Text style={{ color: colors.text40, fontSize: 12 }}>
              {event.checkpoints.length} checkpoints
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default MapSearchResults;
