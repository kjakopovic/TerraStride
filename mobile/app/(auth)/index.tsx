import { View, Text, ScrollView } from "react-native";
import { useTheme } from "@/core/theme";
import * as icons from "@/core/icons";
import React, { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthHeader from "@/components/auth/authHeader";
import CustomAuthInput from "@/components/auth/customAuthInput";
import CustomButton from "@/components/customButton";
import Spacer from "@/components/spacer";
import { STRINGS } from "@/core/constants/strings";

const Login = () => {
  const { colors, fontSizes, spacing } = useTheme();

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
            title={STRINGS.AUTH.LOGIN.TITLE}
            subtitle={STRINGS.AUTH.LOGIN.SUBTITLE}
          />
          <CustomAuthInput
            label={STRINGS.AUTH.LOGIN.EMAIL_LABEL}
            placeholder={STRINGS.AUTH.LOGIN.EMAIL_PLACEHOLDER}
            customMargin={64}
          />
          <CustomAuthInput
            label={STRINGS.AUTH.LOGIN.PASSWORD_LABEL}
            placeholder={STRINGS.AUTH.LOGIN.PASSWORD_PLACEHOLDER}
            secureTextEntry
          />
          <Spacer size={spacing.large} />
          <CustomButton title={STRINGS.AUTH.LOGIN.CTA} onPress={() => {}} />
          <Text
            style={{
              fontSize: fontSizes.medium,
              color: colors.text40,
              textAlign: "center",
              alignSelf: "center",
              marginTop: spacing.medium,
            }}
          >
            {STRINGS.AUTH.COMMON.OR}
          </Text>
          <Spacer size={spacing.medium} />
          <CustomButton
            title={STRINGS.AUTH.LOGIN.GOOGLE_CTA}
            onPress={() => {}}
            variant="secondary"
            icon={icons.google}
          />
          <Spacer size={spacing.small} />
          <CustomButton
            title={STRINGS.AUTH.LOGIN.APPLE_CTA}
            onPress={() => {}}
            variant="secondary"
            icon={icons.apple}
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
            {STRINGS.AUTH.LOGIN.NO_ACCOUNT}{" "}
            <Text
              style={{
                color: colors.primary,
                fontFamily: "LeagueSpartan-Bold",
              }}
            >
              {STRINGS.AUTH.LOGIN.SIGN_UP}
            </Text>
          </Text>
          <Spacer size={spacing.small} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Login;
