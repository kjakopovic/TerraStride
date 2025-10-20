import React from "react";
import { Image, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/core/theme";
import * as icons from "@/core/constants/icons";

type Props = {
  searchQuery: string;
  onChange: (text: string) => void;
  onBack: () => void;
};

const MapSearchBar: React.FC<Props> = ({ searchQuery, onChange, onBack }) => {
  const { colors, borderRadius } = useTheme();

  return (
    <View
      style={{
        position: "absolute",
        top: 64,
        left: 16,
        right: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <TouchableOpacity
        style={{
          height: 48,
          width: 48,
          borderRadius: borderRadius.full,
          backgroundColor: "rgba(240,240,240,0.65)",
          borderColor: colors.background,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
        onPress={onBack}
      >
        <Image source={icons.leftArrow} style={{ height: 14, width: 16 }} />
      </TouchableOpacity>

      <View
        style={{
          flex: 1,
          height: 48,
          borderRadius: borderRadius.full,
          backgroundColor: "rgba(240,240,240,0.65)",
          borderColor: colors.background,
          borderWidth: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <TextInput
          placeholder="Search…"
          placeholderTextColor={colors.text40}
          value={searchQuery}
          onChangeText={onChange}
          style={{ flex: 1, color: colors.text }}
        />
        <Image
          source={icons.search}
          style={{ width: 20, height: 20, tintColor: colors.text40 }}
        />
      </View>
    </View>
  );
};

export default MapSearchBar;
