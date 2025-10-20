import React, { useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  type TextInputProps,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/core/theme";

type CustomAuthInputProps = TextInputProps & {
  label: string;
  customMargin?: number;
  customBorderRadius?: number;
  inputHeight?: number;
};

const CustomAuthInput: React.FC<CustomAuthInputProps> = ({
  label,
  customMargin,
  customBorderRadius,
  inputHeight,
  style,
  multiline,
  ...textInputProps
}) => {
  const { colors, spacing, fontSizes, borderRadius } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: "100%",
        },
        label: {
          marginBottom: 5,
          fontFamily: "LeagueSpartan-Medium",
          fontSize: fontSizes.medium,
          color: colors.text,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.text40,
          padding: spacing.medium,
          paddingHorizontal: 25,
          borderRadius: customBorderRadius
            ? customBorderRadius
            : borderRadius.full,
          marginBottom: 10,
          color: colors.text,
        },
        multilineInput: {
          textAlignVertical: "top",
        },
      }),
    [
      borderRadius.full,
      borderRadius.large,
      colors.text,
      colors.text40,
      fontSizes.medium,
      spacing.medium,
    ]
  );

  return (
    <View
      style={[styles.container, { marginTop: customMargin ?? spacing.large }]}
    >
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...textInputProps}
        multiline={multiline}
        style={[
          styles.input,
          multiline ? styles.multilineInput : null,
          inputHeight ? { height: inputHeight } : null,
          style,
        ]}
        placeholderTextColor={colors.text40}
      />
    </View>
  );
};

export default CustomAuthInput;
