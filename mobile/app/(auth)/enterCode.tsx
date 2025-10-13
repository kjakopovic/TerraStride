import React, { useRef, useState } from "react";
import { View, Text, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthHeader from "@/components/auth/authHeader";
import CustomButton from "@/components/customButton";
import Spacer from "@/components/spacer";
import { useTheme } from "@/core/theme";
import { STRINGS } from "@/core/constants/strings";
import { useRouter } from "expo-router";

const CODE_LENGTH = 6;

const EnterCode = () => {
  const { colors, fontSizes, spacing } = useTheme();
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(""));
  const inputs = useRef<Array<TextInput | null>>([]);
  const router = useRouter();

  const handleChange = (text: string, idx: number) => {
    if (!/^\d*$/.test(text)) return;
    const newCode = [...code];
    newCode[idx] = text.slice(-1);
    setCode(newCode);

    if (text && idx < CODE_LENGTH - 1) {
      inputs.current[idx + 1]?.focus();
    }
  };

  const handleSubmit = () => {
    router.replace("/home");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <View
          style={{
            flex: 1,
            alignItems: "flex-start",
            paddingHorizontal: spacing.defaultPaddingHorizontal,
            paddingTop: spacing.xlarge,
          }}
        >
          <AuthHeader
            title={STRINGS.AUTH.SECURITY_CODE.TITLE}
            subtitle={STRINGS.AUTH.SECURITY_CODE.SUBTITLE}
          />

          <Spacer size={spacing.xlarge} />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: "100%",
              marginBottom: spacing.xlarge,
            }}
          >
            {code.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(ref) => {
                  inputs.current[idx] = ref;
                }}
                value={digit}
                onChangeText={(text) => handleChange(text, idx)}
                keyboardType="number-pad"
                maxLength={1}
                style={{
                  width: 48,
                  height: 56,
                  borderBottomWidth: 2,
                  borderColor: colors.text,
                  textAlign: "center",
                  fontSize: fontSizes.xxlarge,
                  color: colors.text,
                  fontFamily: "LeagueSpartan-Bold",
                }}
                returnKeyType={idx === CODE_LENGTH - 1 ? "done" : "next"}
                onSubmitEditing={() => {
                  if (idx < CODE_LENGTH - 1) {
                    inputs.current[idx + 1]?.focus();
                  }
                }}
              />
            ))}
          </View>

          <CustomButton
            title={STRINGS.AUTH.SECURITY_CODE.CTA}
            onPress={handleSubmit}
            disabled={code.some((digit) => !digit)}
          />

          <Spacer size={spacing.xlarge} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EnterCode;
