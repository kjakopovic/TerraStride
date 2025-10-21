import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AuthHeader from "@/components/auth/authHeader";
import CustomAuthInput from "@/components/auth/customAuthInput";
import CustomButton from "@/components/customButton";
import Spacer from "@/components/spacer";
import { useTheme } from "@/core/theme";
import { STRINGS } from "@/core/constants/strings";
import { useRouter } from "expo-router";
import { RegisterFormValues } from "@/core/types/register";
import { useRegisterFlow } from "@/context/RegisterFlowContext";

const registerSchema = z.object({
  username: z.string().min(3, STRINGS.AUTH.REGISTER.USERNAME_MIN_LENGTH),
  email: z.string().email(STRINGS.AUTH.REGISTER.EMAIL_VALIDATION),
  password: z.string().min(6, STRINGS.AUTH.REGISTER.PASSWORD_MIN_LENGTH),
});

const Register = () => {
  const { colors, fontSizes, spacing } = useTheme();
  const router = useRouter();
  const { setRegisterData } = useRegisterFlow();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    setRegisterData(data);
    router.push("/walletPassphrase");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled">
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

          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              <CustomAuthInput
                label={STRINGS.AUTH.REGISTER.USERNAME_LABEL}
                placeholder={STRINGS.AUTH.REGISTER.USERNAME_PLACEHOLDER}
                customMargin={64}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.username?.message}
                autoCapitalize="none"
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <CustomAuthInput
                label={STRINGS.AUTH.REGISTER.EMAIL_LABEL}
                placeholder={STRINGS.AUTH.REGISTER.EMAIL_PLACEHOLDER}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <CustomAuthInput
                label={STRINGS.AUTH.REGISTER.PASSWORD_LABEL}
                placeholder={STRINGS.AUTH.REGISTER.PASSWORD_PLACEHOLDER}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                secureTextEntry
              />
            )}
          />

          <Spacer size={spacing.large} />

          <CustomButton
            title={STRINGS.AUTH.REGISTER.CTA}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
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
