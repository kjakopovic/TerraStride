import { View, Text, ScrollView } from "react-native";
import { useTheme } from "@/core/theme";
import * as icons from "@/core/constants/icons";
import React, { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthHeader from "@/components/auth/authHeader";
import CustomAuthInput from "@/components/auth/customAuthInput";
import CustomButton from "@/components/customButton";
import Spacer from "@/components/spacer";
import { STRINGS } from "@/core/constants/strings";
import { useRouter } from "expo-router";
import "react-native-get-random-values";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const { colors, fontSizes, spacing } = useTheme();
  const router = useRouter();
  const { login: loginRequest } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const goToRegister = useCallback(() => {
    router.push("/register");
  }, [router]);

  const onSubmit = useCallback(
    async (values: LoginFormValues) => {
      setLoginError(null);
      try {
        await loginRequest(values);
        router.replace("/home");
      } catch (error: any) {
        const message =
          error?.payload?.message ??
          error?.message ??
          "Unable to log in. Please try again.";
        setLoginError(message);
      }
    },
    [loginRequest, router]
  );

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

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <CustomAuthInput
                label={STRINGS.AUTH.LOGIN.EMAIL_LABEL}
                placeholder={STRINGS.AUTH.LOGIN.EMAIL_PLACEHOLDER}
                customMargin={64}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                error={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <CustomAuthInput
                label={STRINGS.AUTH.LOGIN.PASSWORD_LABEL}
                placeholder={STRINGS.AUTH.LOGIN.PASSWORD_PLACEHOLDER}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                error={errors.password?.message}
              />
            )}
          />

          <Spacer size={spacing.large} />

          <CustomButton
            title={STRINGS.AUTH.LOGIN.CTA}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          />

          {loginError ? (
            <Text
              style={{
                fontSize: fontSizes.small,
                color: colors.error,
                marginTop: spacing.medium,
                alignSelf: "center",
              }}
            >
              {loginError}
            </Text>
          ) : null}

          <Text
            style={{
              fontSize: fontSizes.medium,
              color: colors.text40,
              textAlign: "center",
              alignSelf: "center",
              marginTop: spacing.medium,
            }}
          >
            {STRINGS.COMMON.OR}
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
              onPress={goToRegister}
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
