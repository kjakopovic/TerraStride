import React, { type ReactNode, useMemo } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ImageSourcePropType,
  Image,
} from "react-native";
import { useTheme } from "@/core/theme";

type ButtonVariant = "primary" | "secondary";

type CustomButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: ImageSourcePropType;
  disabled?: boolean;
};

const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
}) => {
  const { colors, fontSizes, spacing, borderRadius } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        baseButton: {
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: borderRadius.full,
        },
        content: {
          flexDirection: "row",
          alignItems: "center",
        },
        icon: {
          marginRight: spacing.small,
          width: 24,
          height: 24,
          resizeMode: "contain",
        },
        label: {
          fontFamily: "LeagueSpartan-Bold",
          fontSize: fontSizes.medium,
          marginTop: 2,
        },
        disabled: {
          opacity: 0.5,
        },
      }),
    [borderRadius.full, spacing.small]
  );

  const buttonStyle = [
    styles.baseButton,
    {
      paddingVertical: 14,
      paddingHorizontal: spacing.regularPlus,
    },
    variant === "primary"
      ? { backgroundColor: colors.primary }
      : {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.text40,
        },
    disabled && styles.disabled,
  ];

  const textColor = variant === "primary" ? colors.background : colors.text;

  return (
    <TouchableOpacity onPress={onPress} style={buttonStyle} disabled={disabled}>
      <View style={styles.content}>
        {icon ? <Image source={icon} style={styles.icon} /> : null}
        <Text style={[styles.label, { color: textColor }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default CustomButton;
