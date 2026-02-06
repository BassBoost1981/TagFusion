import { heroui } from "@heroui/react";

const theme = {
  defaultTheme: "dark" as const,
  defaultExtendTheme: "dark" as const,
  layout: {
    fontSize: {
      tiny: "0.75rem",
      small: "0.875rem",
      medium: "1rem",
      large: "1.125rem",
    },
    lineHeight: {
      tiny: "1rem",
      small: "1.25rem",
      medium: "1.5rem",
      large: "1.75rem",
    },
    radius: {
      small: "8px",
      medium: "12px",
      large: "16px",
    },
    borderWidth: {
      small: "1px",
      medium: "2px",
      large: "3px",
    },
  },
  themes: {
    light: {
      colors: {
        background: "#f8fafc",
        foreground: "#0f172a",
        primary: {
          DEFAULT: "#6366f1",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#ec4899",
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "#10b981",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#f59e0b",
          foreground: "#ffffff",
        },
        danger: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        default: {
          DEFAULT: "#e2e8f0",
          foreground: "#0f172a",
        },
        divider: "rgba(0, 0, 0, 0.1)",
        focus: "#6366f1",
        overlay: "rgba(0, 0, 0, 0.5)",
        content1: "#ffffff",
        content2: "#f8fafc",
        content3: "#f1f5f9",
        content4: "#e2e8f0",
      },
    },
    dark: {
      colors: {
        background: "#0c0f1a",
        foreground: "#f1f5f9",
        primary: {
          DEFAULT: "#6366f1",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#ec4899",
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "#10b981",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#f59e0b",
          foreground: "#000000",
        },
        danger: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        default: {
          DEFAULT: "#1e293b",
          foreground: "#f1f5f9",
        },
        divider: "rgba(255, 255, 255, 0.08)",
        focus: "#6366f1",
        overlay: "rgba(0, 0, 0, 0.7)",
        content1: "#111827",
        content2: "#1e293b",
        content3: "#334155",
        content4: "#475569",
      },
    },
  },
};

export default heroui(theme);