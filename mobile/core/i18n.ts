import * as Localization from "expo-localization";
import { I18n, type TranslateOptions } from "i18n-js";
import { useSyncExternalStore, useCallback } from "react";

const translations = {
  en: {
    auth: {
      appName: "TerraStride",
      login: {
        title: "Log into your account and start making your runs count",
        subtitle: "Enter your details below to continue to your account",
        emailLabel: "Email",
        emailPlaceholder: "Enter your email",
        passwordLabel: "Password",
        passwordPlaceholder: "Enter your password",
        cta: "Log In",
        googleCta: "Log In with Google",
        appleCta: "Log In with Apple",
        noAccount: "Don't have an account?",
        signUp: "Sign Up",
      },
    },
    common: {
      or: "or",
    },
  },
  es: {
    auth: {
      appName: "TerraStride",
      login: {
        title:
          "Inicia sesión en tu cuenta y empieza a hacer que tus carreras cuenten",
        subtitle:
          "Ingresa tus datos a continuación para continuar en tu cuenta",
        emailLabel: "Correo electrónico",
        emailPlaceholder: "Ingresa tu correo electrónico",
        passwordLabel: "Contraseña",
        passwordPlaceholder: "Ingresa tu contraseña",
        cta: "Iniciar sesión",
        googleCta: "Iniciar sesión con Google",
        appleCta: "Iniciar sesión con Apple",
        noAccount: "¿No tienes una cuenta?",
        signUp: "Regístrate",
      },
    },
    common: {
      or: "o",
    },
  },
} as const;

type TranslationMap = typeof translations;
type AvailableLocale = keyof TranslationMap;
type LocaleDictionary = TranslationMap[AvailableLocale];

type NestedKeyOf<T> = T extends Record<string, unknown>
  ? {
      [K in keyof T & string]: T[K] extends Record<string, unknown>
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

type TranslationKey = NestedKeyOf<LocaleDictionary>;

const defaultLocale: AvailableLocale = "es";

const i18n = new I18n(translations);
i18n.defaultLocale = defaultLocale;
i18n.enableFallback = true;

const locales = Localization.getLocales();
const deviceLanguageTag =
  locales?.[0]?.languageTag ?? locales?.[0]?.languageCode ?? defaultLocale;

const matchedLocale =
  (Object.keys(translations) as AvailableLocale[]).find((locale) =>
    deviceLanguageTag.startsWith(locale)
  ) ?? defaultLocale;

const listeners = new Set<() => void>();
let currentLocale: AvailableLocale = matchedLocale;

i18n.locale = currentLocale;

const notifyLocaleChange = () => {
  listeners.forEach((listener) => listener());
};

const subscribeLocale = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getLocale = () => currentLocale;

export const setLocale = (locale: AvailableLocale) => {
  if (locale === currentLocale) {
    return;
  }
  currentLocale = locale;
  i18n.locale = locale;
  notifyLocaleChange();
};

export const useLocale = () =>
  useSyncExternalStore(subscribeLocale, getLocale, getLocale);

export const t = (key: TranslationKey, config?: TranslateOptions) =>
  i18n.t(key, config);

export const availableLocales = Object.keys(translations) as AvailableLocale[];
export { i18n };

export const useTranslation = () => {
  const locale = useLocale();
  const translate = useCallback(
    (key: TranslationKey, config?: TranslateOptions) => i18n.t(key, config),
    [locale]
  );
  return { t: translate, locale };
};
