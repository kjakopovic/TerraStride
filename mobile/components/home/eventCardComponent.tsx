import { View, Text, Image } from "react-native";
import React from "react";
import { useTheme } from "@/core/theme";
import * as icons from "@/core/constants/icons";

const EventCardComponent = ({
  title,
  prizePool,
  startTime,
}: {
  title: string;
  prizePool: number;
  startTime: string;
}) => {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: colors.text40,
        paddingVertical: 10,
        marginBottom: 10,
        width: "100%",
      }}
    >
      <View style={{ gap: spacing.small }}>
        <Text
          style={{
            fontSize: 16,
            fontFamily: "LeagueSpartan-Medium",
            color: colors.text,
          }}
        >
          {title}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.small,
          }}
        >
          <Image
            source={icons.banknote}
            style={{ height: 10, width: 16, tintColor: colors.text }}
          />
          <Text
            style={{
              fontSize: 14,
              fontFamily: "LeagueSpartan-Bold",
              color: colors.success,
            }}
          >
            ${prizePool}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.small,
          }}
        >
          <Image
            source={icons.clock}
            style={{ height: 15, width: 16, tintColor: colors.text }}
          />
          <Text
            style={{
              fontSize: 14,
              fontFamily: "LeagueSpartan-Medium",
              color: colors.text40,
            }}
          >
            {startTime}
          </Text>
        </View>
      </View>
      <Image
        source={icons.rightArrow}
        style={{ height: 16, width: 16, marginLeft: "auto" }}
      />
    </View>
  );
};

export default EventCardComponent;
