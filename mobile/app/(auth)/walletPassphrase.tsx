import React, { useEffect, useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "@/components/customButton";
import Spacer from "@/components/spacer";
import { useTheme } from "@/core/theme";
import { STRINGS } from "@/core/constants/strings";
import { useRouter } from "expo-router";
import { useRegisterFlow } from "@/context/RegisterFlowContext";

const WalletPassphrase = () => {
  const { colors, fontSizes, spacing } = useTheme();
  const router = useRouter();
  const { registerData, passphrase, setPassphrase } = useRegisterFlow();

  useEffect(() => {
    if (!registerData) {
      router.replace("/register");
    }
  }, [registerData, router]);

  const generatedPassphrase = useMemo(
    () =>
      passphrase ??
      "planet lens truck silk velvet hazard canyon galaxy lemon summit vivid answer",
    [passphrase]
  );

  const handleContinue = () => {
    if (!registerData) return;
    setPassphrase(generatedPassphrase);
    router.push("/enterCode");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.defaultPaddingHorizontal,
          paddingVertical: spacing.xlarge,
          gap: spacing.large,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: fontSizes.xxlarge,
            fontFamily: "LeagueSpartan-Bold",
          }}
        >
          {STRINGS.AUTH.WALLET_PASSPHRASE.TITLE}
        </Text>

        <Text
          style={{
            color: colors.text40,
            fontSize: fontSizes.medium,
            fontFamily: "LeagueSpartan-Regular",
          }}
        >
          {STRINGS.AUTH.WALLET_PASSPHRASE.DESCRIPTION}
        </Text>

        <View
          style={{
            borderWidth: 1,
            borderColor: "rgba(33,33,33,0.12)",
            borderRadius: 16,
            padding: spacing.large,
            backgroundColor: "rgba(240,240,240,0.3)",
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: fontSizes.large,
              lineHeight: fontSizes.large * 1.4,
              fontFamily: "LeagueSpartan-SemiBold",
            }}
          >
            {generatedPassphrase}
          </Text>
        </View>

        <Spacer size={spacing.xlarge} />

        <CustomButton
          title={STRINGS.AUTH.WALLET_PASSPHRASE.CTA}
          onPress={handleContinue}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default WalletPassphrase;
