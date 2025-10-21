import { View, Text } from "react-native";
import React from "react";
import { Stack } from "expo-router";
import { RegisterFlowProvider } from "@/context/RegisterFlowContext";

const AuthLayout = () => (
  <RegisterFlowProvider>
    <Stack screenOptions={{ headerShown: false }} />
  </RegisterFlowProvider>
);

export default AuthLayout;
