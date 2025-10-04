import { View, Text, TextInput } from "react-native";
import { useTheme } from "@/core/theme";
import React from "react";

const CustomAuthInput = ({
  label,
  placeholder,
  customMargin,
  secureTextEntry,
  height,
}: {
  label: string;
  placeholder: string;
  customMargin?: number;
  secureTextEntry?: boolean;
  height?: number;
}) => {
  const { colors, fontSizes, borderRadius } = useTheme();

  return (
    <View style={{ width: "100%", marginTop: customMargin || 16 }}>
      <Text
        style={{
          marginBottom: 5,
          fontFamily: "LeagueSpartan-Medium",
          fontSize: fontSizes.medium,
        }}
      >
        {label}
      </Text>
      {height ? (
        <TextInput
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          style={{
            borderWidth: 1,
            borderColor: colors.text40,
            padding: 12,
            paddingHorizontal: 25,
            borderRadius: borderRadius.full,
            marginBottom: 10,
          }}
        />
      ) : (
        <TextInput
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          style={{
            borderWidth: 1,
            borderColor: colors.text40,
            padding: 12,
            paddingHorizontal: 25,
            borderRadius: borderRadius.full,
            marginBottom: 10,
            height: height,
          }}
        />
      )}
    </View>
  );
};

export default CustomAuthInput;
