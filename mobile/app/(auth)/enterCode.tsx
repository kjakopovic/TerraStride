import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthHeader from "@/components/auth/authHeader";
import CustomButton from "@/components/customButton";
import Spacer from "@/components/spacer";
import { useTheme } from "@/core/theme";
import { STRINGS } from "@/core/constants/strings";
import { useRouter } from "expo-router";
import {
  VerificationCodeValues,
  verificationCodeSchema,
} from "@/core/types/verificationCode";
import { useRegisterFlow } from "@/context/RegisterFlowContext";
import { useAuth } from "@/hooks/useAuth";
import EmailVerificationModal from "@/components/auth/EmailVerificationModal";

const CODE_LENGTH = 6;

const emailVerificationSchema = z.object({
  code: z.string().regex(/^\d{6}$/, STRINGS.AUTH.EMAIL_VERIFICATION.CODE_ERROR),
});

type EmailVerificationValues = z.infer<typeof emailVerificationSchema>;

const EnterCode = () => {
  const { colors, fontSizes, spacing } = useTheme();
  const router = useRouter();
  const inputs = useRef<Array<TextInput | null>>([]);
  const { registerData, passphrase, resetRegisterFlow } = useRegisterFlow();
  const { register: registerUser, emailConfirmation } = useAuth();

  const {
    handleSubmit: handlePasscodeSubmit,
    setValue,
    watch,
    formState: { errors: passcodeErrors },
  } = useForm<VerificationCodeValues>({
    resolver: zodResolver(verificationCodeSchema),
    defaultValues: {
      codeDigits: Array(CODE_LENGTH).fill(""),
    },
  });

  const {
    control: emailControl,
    handleSubmit: handleEmailSubmit,
    reset: resetEmailForm,
    formState: { errors: emailErrors },
  } = useForm<EmailVerificationValues>({
    resolver: zodResolver(emailVerificationSchema),
    defaultValues: { code: "" },
  });

  const [registerError, setRegisterError] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const [registerLoading, setRegisterLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationModalVisible, setVerificationModalVisible] =
    useState(false);

  const codeDigits = watch("codeDigits");

  useEffect(() => {
    if (!registerData) {
      router.replace("/register");
      return;
    }
    if (!passphrase) {
      router.replace("/walletPassphrase");
    }
  }, [registerData, passphrase, router]);

  const handleChange = (text: string, idx: number) => {
    if (!/^\d*$/.test(text)) return;

    const value = text.slice(-1);
    const next = [...codeDigits];
    next[idx] = value;
    setValue("codeDigits", next, { shouldValidate: true });

    if (value && idx < CODE_LENGTH - 1) {
      inputs.current[idx + 1]?.focus();
    }
  };

  const handleBackspace = (idx: number) => {
    if (!codeDigits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const onSubmitPasscode = async (values: VerificationCodeValues) => {
    if (!registerData || !passphrase) return;

    const passcode = values.codeDigits.join("");
    setRegisterLoading(true);
    setRegisterError(null);
    setVerificationError(null);

    try {
      await registerUser({
        username: registerData.username,
        email: registerData.email,
        password: registerData.password,
        passcode,
      });

      resetEmailForm({ code: "" });
      setVerificationModalVisible(true);
    } catch (error: any) {
      const message =
        error?.payload?.message ??
        error?.message ??
        STRINGS.AUTH.EMAIL_VERIFICATION.REGISTER_FAIL;
      setRegisterError(message);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleVerifyEmail = async ({ code }: EmailVerificationValues) => {
    if (!registerData) return;

    setVerificationLoading(true);
    setVerificationError(null);

    try {
      await emailConfirmation({ email: registerData.email, code });
      resetEmailForm({ code: "" });
      setVerificationModalVisible(false);
      resetRegisterFlow();
      Alert.alert(
        STRINGS.AUTH.EMAIL_VERIFICATION.SUCCESS_TITLE,
        STRINGS.AUTH.EMAIL_VERIFICATION.SUCCESS_MESSAGE,
        [{ text: STRINGS.COMMON.OK, onPress: () => router.replace("/") }]
      );
    } catch (error: any) {
      const message =
        error?.payload?.message ??
        error?.message ??
        STRINGS.AUTH.EMAIL_VERIFICATION.CODE_FAIL;
      setVerificationError(message);
    } finally {
      setVerificationLoading(false);
    }
  };

  const codeError =
    (passcodeErrors.codeDigits as unknown as { message?: string })?.message ??
    (
      passcodeErrors.codeDigits as
        | Record<string, { message?: string }>
        | undefined
    )?.root?.message;

  const buttonDisabled =
    registerLoading ||
    codeDigits.some((digit) => !digit || digit.trim().length === 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled">
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
              marginBottom: spacing.large,
            }}
          >
            {codeDigits.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(ref) => {
                  inputs.current[idx] = ref;
                }}
                value={digit}
                onChangeText={(text) => handleChange(text, idx)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === "Backspace") {
                    handleBackspace(idx);
                  }
                }}
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

          {codeError ? (
            <Text
              style={{
                color: colors.error,
                marginBottom: spacing.large,
                fontSize: fontSizes.small,
              }}
            >
              {codeError}
            </Text>
          ) : (
            <Spacer size={spacing.large} />
          )}

          <CustomButton
            title={STRINGS.AUTH.SECURITY_CODE.CTA}
            onPress={handlePasscodeSubmit(onSubmitPasscode)}
            disabled={buttonDisabled}
          />

          {registerError ? (
            <Text
              style={{
                color: colors.error,
                marginTop: spacing.medium,
                fontSize: fontSizes.small,
              }}
            >
              {registerError}
            </Text>
          ) : null}

          <Spacer size={spacing.xlarge} />
        </View>
      </ScrollView>

      <EmailVerificationModal
        visible={verificationModalVisible}
        email={registerData?.email ?? ""}
        control={emailControl}
        errors={emailErrors}
        apiError={verificationError}
        loading={verificationLoading}
        onSubmit={handleEmailSubmit(handleVerifyEmail)}
        onCancel={() => {
          setVerificationModalVisible(false);
          resetEmailForm({ code: "" });
          setVerificationError(null);
        }}
      />
    </SafeAreaView>
  );
};

export default EnterCode;
