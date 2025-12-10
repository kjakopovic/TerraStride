import React, { useEffect, useRef } from "react";
import { Animated, Image, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/core/theme";
import * as icons from "@/core/constants/icons";

const FAB_ACTIONS = [icons.layer, icons.trophy, icons.plus] as const;

type Props = {
  open: boolean;
  toggle: () => void;
  onAction: (index: number) => void;
};

const MapFabMenu: React.FC<Props> = ({ open, toggle, onAction }) => {
  const { colors, borderRadius } = useTheme();
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animation, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 60,
    }).start();
  }, [open, animation]);

  return (
    <View
      style={{
        position: "absolute",
        bottom: 64,
        right: 24,
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      <Animated.View
        style={{
          gap: 12,
          opacity: animation,
          transform: [
            {
              translateY: animation.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        }}
        pointerEvents={open ? "auto" : "none"}
      >
        {FAB_ACTIONS.map((iconSource, idx) => (
          <TouchableOpacity
            key={idx}
            style={{
              height: 56,
              width: 56,
              borderRadius: borderRadius.full,
              backgroundColor: colors.primary70,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
            onPress={() => onAction(idx)}
          >
            <Image
              source={iconSource}
              style={{ width: 22, height: 22, tintColor: colors.background }}
            />
          </TouchableOpacity>
        ))}
      </Animated.View>

      <TouchableOpacity
        style={{
          height: 64,
          width: 64,
          borderRadius: borderRadius.full,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }}
        onPress={toggle}
      >
        <Image
          source={open ? icons.close : icons.plus}
          style={{ width: 22, height: 22, tintColor: colors.background }}
        />
      </TouchableOpacity>
    </View>
  );
};

export default MapFabMenu;
