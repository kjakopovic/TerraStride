import { createContext, useContext } from "react";
export const theme = {
  colors: {
    primary: "#FC4C02",
    background: "#FAFAFA",
    text: "#212121",
    text40: "rgba(33, 33, 33, 0.4)",
    success: "#4CD964",
    error: "#FF3B30",
    warning: "#FF9500",
    info: "#5AC8FA",
  },
  spacing: {
    small: 8,
    regular: 10,
    regularPlus: 12,
    medium: 16,
    large: 24,
    xlarge: 32,
    defaultPaddingHorizontal: 25,
  },
  fontSizes: {
    small: 12,
    medium: 16,
    large: 20,
    xlarge: 24,
    xxlarge: 32,
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 12,
    xlarge: 16,
    full: 9999,
  },
};

const ThemeContext = createContext(theme);
export const ThemeProvider = ThemeContext.Provider;

export const useTheme = () => useContext(ThemeContext);
