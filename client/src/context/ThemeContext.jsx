import { createContext, useCallback, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

const readMode = () => {
  try {
    return localStorage.getItem("themeMode") || "dark";
  } catch {
    return "dark";
  }
};

const systemDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;

export function ThemeProvider({ children }) {
  const [themeMode, setMode] = useState(readMode);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const apply = () => {
      const dark = themeMode === "dark" || (themeMode === "system" && systemDark());
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      setIsDark(dark);
    };
    apply();
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [themeMode]);

  const setThemeMode = useCallback((mode) => {
    setMode(mode);
    try {
      localStorage.setItem("themeMode", mode);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }, []);

  const toggleTheme = useCallback(() => setThemeMode(isDark ? "light" : "dark"), [isDark, setThemeMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
