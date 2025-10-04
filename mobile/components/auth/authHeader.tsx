import { View, Text, Image } from "react-native";
import { useTheme } from "@/core/theme";
import * as images from "@/core/images";
import React from "react";
import { STRINGS } from "@/core/constants/strings";

const AuthHeader = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => {
  const { colors, fontSizes, spacing } = useTheme();

  return (
    <View style={{ width: "100%" }}>
      <Text
        style={{
          color: colors.primary,
          fontSize: fontSizes.xxlarge,
          fontFamily: "LeagueSpartan-Bold",
        }}
      >
        {STRINGS.AUTH.APP_NAME}
      </Text>
      <Text
        style={{
          color: colors.text,
          fontSize: fontSizes.large,
          marginTop: spacing.medium,
          fontFamily: "LeagueSpartan-SemiBold",
          width: "75%",
        }}
      >
        {title ?? STRINGS.AUTH.LOGIN.TITLE}
      </Text>
      <Text
        style={{
          color: colors.text40,
          fontSize: fontSizes.medium,
          marginTop: spacing.medium,
          fontFamily: "LeagueSpartan-Regular",
          width: "80%",
        }}
      >
        {subtitle ?? STRINGS.AUTH.LOGIN.SUBTITLE}
      </Text>
      <Image
        source={images.authDeco}
        style={{
          height: 250,
          width: 230,
          position: "absolute",
          top: "12%",
          right: -30,
        }}
      />
    </View>
  );
};
export default AuthHeader;
