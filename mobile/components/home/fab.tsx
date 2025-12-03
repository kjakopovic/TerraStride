import React, { FC } from "react";
import { View, TouchableOpacity, Image, ViewStyle } from "react-native";
import { useTheme } from "@/core/theme";
import { useRouter } from "expo-router";
import * as icons from "@/core/constants/icons";

type FloatingActionBarProps = {
  onRunPress?: () => void;
  onMapPress?: () => void;
  onWalletPress?: () => void;
  containerStyle?: ViewStyle;
};

const FloatingActionBar: FC<FloatingActionBarProps> = ({
  onRunPress,
  onMapPress,
  onWalletPress,
  containerStyle,
}) => {
  const { colors, borderRadius, spacing } = useTheme();
  const router = useRouter();

  const handleSearchPress = () => {
    router.push("/search");
  };

  return (
    <View
      style={{
        position: "absolute",
        bottom: spacing.xlarge,
        left: 0,
        right: 0,
        alignItems: "center",
        ...containerStyle,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.medium,
        }}
      >
        <TouchableOpacity
          style={{
            height: 45,
            width: 45,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primary70,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.text40,
            shadowOpacity: 0.4,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 5 },
          }}
          onPress={onRunPress}
        >
          <Image
            source={icons.figureRun}
            style={{ height: 20, width: 16, tintColor: colors.background }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            height: 45,
            width: 96,
            borderRadius: borderRadius.large,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.text40,
            shadowOpacity: 0.45,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 6 },
          }}
          onPress={onMapPress}
        >
          <Image
            source={icons.mapWhite}
            style={{ height: 22, width: 24, tintColor: colors.background }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            height: 45,
            width: 45,
            borderRadius: borderRadius.full,
            backgroundColor: colors.primary70,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: colors.text40,
            shadowOpacity: 0.4,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 5 },
          }}
          onPress={handleSearchPress}
        >
          <Image
            source={icons.search}
            style={{ height: 20, width: 20, tintColor: colors.background }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default FloatingActionBar;
