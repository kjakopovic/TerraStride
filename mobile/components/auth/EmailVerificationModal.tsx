import React from "react";
import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Controller, Control, FieldErrors } from "react-hook-form";
import { useTheme } from "@/core/theme";
import CustomButton from "@/components/customButton";
import { STRINGS } from "@/core/constants/strings";

type EmailVerificationForm = { code: string };

type Props = {
  visible: boolean;
  email: string;
  control: Control<EmailVerificationForm>;
  errors: FieldErrors<EmailVerificationForm>;
  apiError: string | null;
  loading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
};

const EmailVerificationModal: React.FC<Props> = ({
  visible,
  email,
  control,
  errors,
  apiError,
  loading,
  onSubmit,
  onCancel,
}) => {
  const { colors, fontSizes } = useTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderRadius: 16,
            padding: 24,
            gap: 16,
          }}
        >
          <Text
            style={{
              fontSize: fontSizes.large,
              fontFamily: "LeagueSpartan-Bold",
              color: colors.text,
            }}
          >
            {STRINGS.AUTH.EMAIL_VERIFICATION.TITLE}
          </Text>

          <Text style={{ color: colors.text40 }}>
            {STRINGS.AUTH.EMAIL_VERIFICATION.DESCRIPTION.replace(
              "{email}",
              email
            )}
          </Text>

          <Controller
            control={control}
            name="code"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="number-pad"
                maxLength={6}
                placeholder={STRINGS.AUTH.EMAIL_VERIFICATION.PLACEHOLDER}
                placeholderTextColor={colors.text40}
                style={{
                  borderWidth: 1,
                  borderColor: errors.code
                    ? colors.error
                    : "rgba(33,33,33,0.12)",
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  fontSize: fontSizes.large,
                  textAlign: "center",
                  letterSpacing: 6,
                  color: colors.text,
                  fontFamily: "LeagueSpartan-Bold",
                }}
              />
            )}
          />

          {errors.code?.message ? (
            <Text style={{ color: colors.error }}>{errors.code.message}</Text>
          ) : null}

          {apiError ? (
            <Text style={{ color: colors.error }}>{apiError}</Text>
          ) : null}

          <CustomButton
            title={STRINGS.AUTH.EMAIL_VERIFICATION.CTA}
            onPress={onSubmit}
            disabled={loading}
          />

          <TouchableOpacity
            onPress={() => {
              if (!loading) onCancel();
            }}
            style={{ alignSelf: "center", paddingVertical: 8 }}
          >
            <Text
              style={{
                color: colors.text40,
                fontFamily: "LeagueSpartan-SemiBold",
              }}
            >
              {STRINGS.AUTH.EMAIL_VERIFICATION.CANCEL}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default EmailVerificationModal;
