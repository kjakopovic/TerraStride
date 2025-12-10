import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { RegisterFormValues } from "@/core/types/register";

type RegisterFlowContextValue = {
  registerData: RegisterFormValues | null;
  passphrase: string | null;
  setRegisterData: (values: RegisterFormValues | null) => void;
  setPassphrase: (value: string | null) => void;
  resetRegisterFlow: () => void;
};

const RegisterFlowContext = createContext<RegisterFlowContextValue | undefined>(
  undefined
);

export const RegisterFlowProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [registerData, setRegisterDataState] =
    useState<RegisterFormValues | null>(null);
  const [passphrase, setPassphraseState] = useState<string | null>(null);

  const setRegisterData = useCallback((values: RegisterFormValues | null) => {
    setRegisterDataState(values);
  }, []);

  const setPassphrase = useCallback((value: string | null) => {
    setPassphraseState(value);
  }, []);

  const resetRegisterFlow = useCallback(() => {
    setRegisterDataState(null);
    setPassphraseState(null);
  }, []);

  const value = useMemo(
    () => ({
      registerData,
      passphrase,
      setRegisterData,
      setPassphrase,
      resetRegisterFlow,
    }),
    [
      registerData,
      passphrase,
      setRegisterData,
      setPassphrase,
      resetRegisterFlow,
    ]
  );

  return (
    <RegisterFlowContext.Provider value={value}>
      {children}
    </RegisterFlowContext.Provider>
  );
};

export const useRegisterFlow = () => {
  const context = useContext(RegisterFlowContext);
  if (!context) {
    throw new Error(
      "useRegisterFlow must be used within a RegisterFlowProvider"
    );
  }
  return context;
};
