// Professional theme definitions with solid colors only
export interface ThemeColors {
  name: string
  displayName: string
  primary: string // HSL format for CSS variables
  primaryRgb: string // RGB for special cases
}

export const themes: ThemeColors[] = [
  {
    name: "blue",
    displayName: "Professional Blue",
    primary: "213 94% 58%", // Windows 11 Blue
    primaryRgb: "15, 108, 189",
  },
  {
    name: "purple",
    displayName: "Creative Purple",
    primary: "262 52% 47%", // Professional Purple
    primaryRgb: "91, 33, 182",
  },
  {
    name: "green",
    displayName: "Nature Green",
    primary: "142 71% 45%", // Clean Green
    primaryRgb: "16, 185, 129",
  },
  {
    name: "orange",
    displayName: "Energetic Orange",
    primary: "25 95% 53%", // Warm Orange
    primaryRgb: "249, 115, 22",
  },
  {
    name: "teal",
    displayName: "Modern Teal",
    primary: "173 80% 40%", // Professional Teal
    primaryRgb: "20, 184, 166",
  },
  {
    name: "pink",
    displayName: "Vibrant Pink",
    primary: "330 81% 60%", // Clean Pink
    primaryRgb: "236, 72, 153",
  },
  {
    name: "red",
    displayName: "Bold Red",
    primary: "0 84% 60%", // Strong Red
    primaryRgb: "239, 68, 68",
  },
  {
    name: "indigo",
    displayName: "Deep Indigo",
    primary: "239 84% 67%", // Rich Indigo
    primaryRgb: "99, 102, 241",
  },
  {
    name: "cyan",
    displayName: "Fresh Cyan",
    primary: "189 94% 43%", // Bright Cyan
    primaryRgb: "6, 182, 212",
  },
  {
    name: "amber",
    displayName: "Warm Amber",
    primary: "43 96% 56%", // Golden Amber
    primaryRgb: "245, 158, 11",
  },
]

export const applyTheme = (themeName: string) => {
  const theme = themes.find((t) => t.name === themeName) || themes[0]
  
  console.log("applyTheme called with:", themeName, "found theme:", theme)

  // Update CSS variables for the primary color with !important to override CSS
  document.documentElement.style.setProperty("--primary", theme.primary, "important")
  console.log("Set --primary to:", theme.primary)

  // Calculate accent color (lighter version for light mode, darker for dark mode)
  const isDark = document.documentElement.classList.contains("dark")
  if (isDark) {
    // Darker accent in dark mode
    document.documentElement.style.setProperty(
      "--accent",
      `${theme.primary.split(" ")[0]} ${theme.primary.split(" ")[1]} 20%`,
      "important"
    )
    document.documentElement.style.setProperty(
      "--accent-foreground",
      `${theme.primary.split(" ")[0]} ${theme.primary.split(" ")[1]} 85%`,
      "important"
    )
  } else {
    // Lighter accent in light mode
    document.documentElement.style.setProperty(
      "--accent",
      `${theme.primary.split(" ")[0]} ${theme.primary.split(" ")[1]} 96%`,
      "important"
    )
    document.documentElement.style.setProperty("--accent-foreground", theme.primary, "important")
  }

  // Store theme preference
  localStorage.setItem("colorTheme", themeName)
  console.log("Saved colorTheme to localStorage:", themeName)
}

export const getCurrentTheme = (): string => {
  return localStorage.getItem("colorTheme") || "blue"
}
