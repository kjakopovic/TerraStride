import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthHeader from "@/components/auth/authHeader";
import CustomAuthInput from "@/components/auth/customAuthInput";
import CustomButton from "@/components/customButton";
import Spacer from "@/components/spacer";
import { useTheme } from "@/core/theme";
import { STRINGS } from "@/core/constants/strings";
import { useRouter } from "expo-router";

const WalletPassphrase = () => {
  const { colors, fontSizes, spacing } = useTheme();
  const generatedPassphrase =
    "planet lens truck silk velvet hazard canyon galaxy lemon summit vivid answer";

  const router = useRouter();

  const goToEnterCode = () => {
    router.push("/enterCode");
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
            title={STRINGS.AUTH.WALLET_PASSPHRASE.TITLE}
            subtitle={STRINGS.AUTH.WALLET_PASSPHRASE.SUBTITLE}
          />

          <Text
            style={{
              marginTop: spacing.large,
              fontSize: fontSizes.medium,
              color: colors.text40,
              fontFamily: "LeagueSpartan-Regular",
              width: "90%",
            }}
          >
            {STRINGS.AUTH.WALLET_PASSPHRASE.DESCRIPTION}
          </Text>

          <CustomAuthInput
            label={STRINGS.AUTH.WALLET_PASSPHRASE.INPUT_LABEL}
            value={generatedPassphrase}
            editable={false}
            customBorderRadius={8}
            multiline
            inputHeight={spacing.xlarge * 5}
            customMargin={spacing.xlarge}
          />

          <Spacer size={spacing.large} />

          <CustomButton
            title={STRINGS.AUTH.WALLET_PASSPHRASE.CTA}
            onPress={goToEnterCode}
          />

          <Spacer size={spacing.large} />

          <Text
            style={{
              fontSize: fontSizes.small,
              color: colors.text40,
              textAlign: "center",
              fontFamily: "LeagueSpartan-Regular",
              width: "100%",
            }}
          >
            {STRINGS.AUTH.WALLET_PASSPHRASE.DISCLAIMER}
          </Text>

          <Spacer size={spacing.xlarge} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default WalletPassphrase;
