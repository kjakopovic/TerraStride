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

const Register = () => {
  const { colors, fontSizes, spacing } = useTheme();

  const router = useRouter();

  const goToWalletPassphrase = () => {
    router.push("/walletPassphrase");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <View
          style={{
            flex: 1,
            justifyContent: "flex-start",
            alignItems: "flex-start",
            paddingHorizontal: spacing.defaultPaddingHorizontal,
            paddingTop: spacing.xlarge,
          }}
        >
          <AuthHeader
            title={STRINGS.AUTH.REGISTER.TITLE}
            subtitle={STRINGS.AUTH.REGISTER.SUBTITLE}
          />
          <CustomAuthInput
            label={STRINGS.AUTH.REGISTER.USERNAME_LABEL}
            placeholder={STRINGS.AUTH.REGISTER.USERNAME_PLACEHOLDER}
            customMargin={64}
          />
          <CustomAuthInput
            label={STRINGS.AUTH.REGISTER.EMAIL_LABEL}
            placeholder={STRINGS.AUTH.REGISTER.EMAIL_PLACEHOLDER}
          />
          <CustomAuthInput
            label={STRINGS.AUTH.REGISTER.PASSWORD_LABEL}
            placeholder={STRINGS.AUTH.REGISTER.PASSWORD_PLACEHOLDER}
            secureTextEntry
          />
          <Spacer size={spacing.large} />
          <CustomButton
            title={STRINGS.AUTH.REGISTER.CTA}
            onPress={goToWalletPassphrase}
          />
          <Spacer size={spacing.large} />
          <Text
            style={{
              fontSize: fontSizes.medium,
              color: colors.text,
              fontFamily: "LeagueSpartan-Regular",
              textAlign: "center",
              alignSelf: "center",
            }}
          >
            {STRINGS.AUTH.REGISTER.HAVE_ACCOUNT}{" "}
            <Text
              style={{
                color: colors.primary,
                fontFamily: "LeagueSpartan-Bold",
              }}
            >
              {STRINGS.AUTH.REGISTER.SIGN_IN}
            </Text>
          </Text>
          <Spacer size={spacing.small} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Register;
