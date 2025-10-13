import { View, Text, ImageSourcePropType, Image } from "react-native";
import React from "react";
import { useTheme } from "@/core/theme";
import * as icons from "@/core/constants/icons";

const CardComponent = ({
  title,
  icon,
  stat,
  statValue,
}: {
  title: string;
  icon: ImageSourcePropType;
  stat: string;
  statValue: string | number;
}) => {
  const { colors, borderRadius, fontSizes } = useTheme();

  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderColor: colors.text40,
        flexDirection: "row",
        paddingVertical: 10,
        marginTop: 10,
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <View
        style={{
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: 10,
          height: 60,
        }}
      >
        <Image
          source={icon}
          style={{ width: 20, height: 20 }}
          tintColor={colors.text40}
        />
        <Text
          style={{
            color: colors.text,
            fontFamily: "LeagueSpartan-Medium",
            fontSize: fontSizes.medium,
          }}
        >
          {title}
        </Text>
      </View>
      <View
        style={{
          alignItems: "flex-start",
          justifyContent: "space-evenly",
          height: 60,
          gap: 10,
        }}
      >
        <Text
          style={{
            color: colors.text40,
            fontFamily: "LeagueSpartan-Medium",
            fontSize: fontSizes.medium,
          }}
        >
          {stat}
        </Text>
        <Text
          style={{
            color: colors.success,
            fontFamily: "LeagueSpartan-Medium",
            fontSize: fontSizes.medium,
          }}
        >
          {statValue}
        </Text>
      </View>
      <Image source={icons.rightArrow} style={{ width: 20, height: 20 }} />
    </View>
  );
};

export default CardComponent;
