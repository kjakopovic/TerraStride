import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/core/theme";

const MapRoutingWarning = ({ message }: { message: string | null }) => {
  const { colors, borderRadius } = useTheme();
  if (!message) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 140,
        left: 16,
        right: 16,
        padding: 14,
        borderRadius: borderRadius.medium,
        backgroundColor: colors.warning,
      }}
    >
      <Text style={{ color: colors.background, textAlign: "center" }}>
        {message}
      </Text>
    </View>
  );
};

export default MapRoutingWarning;
