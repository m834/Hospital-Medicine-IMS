/**
 * Theme Configuration
 * Defines all available themes and their CSS variable values
 */

export type ThemeName = 'default' | 'blue' | 'green' | 'purple' | 'dark';

export interface ThemeColors {
  // Background colors
  background: string;
  foreground: string;
  
  // Card/Panel colors
  card: string;
  cardForeground: string;
  
  // Popover colors
  popover: string;
  popoverForeground: string;
  
  // Primary brand colors
  primary: string;
  primaryForeground: string;
  
  // Secondary colors
  secondary: string;
  secondaryForeground: string;
  
  // Muted colors
  muted: string;
  mutedForeground: string;
  
  // Accent colors
  accent: string;
  accentForeground: string;
  
  // Destructive/Error colors
  destructive: string;
  destructiveForeground: string;
  
  // Border and input colors
  border: string;
  input: string;
  ring: string;
  
  // Chart colors (for reports/analytics)
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  
  // Radius
  radius: string;
}

export const themes: Record<ThemeName, ThemeColors> = {
  // Default Theme (Hospital Blue-Green)
  default: {
    background: '0 0% 100%',
    foreground: '222.2 84% 4.9%',
    card: '0 0% 100%',
    cardForeground: '222.2 84% 4.9%',
    popover: '0 0% 100%',
    popoverForeground: '222.2 84% 4.9%',
    primary: '221.2 83.2% 53.3%', // Hospital Blue
    primaryForeground: '210 40% 98%',
    secondary: '210 40% 96.1%',
    secondaryForeground: '222.2 47.4% 11.2%',
    muted: '210 40% 96.1%',
    mutedForeground: '215.4 16.3% 46.9%',
    accent: '210 40% 96.1%',
    accentForeground: '222.2 47.4% 11.2%',
    destructive: '0 84.2% 60.2%',
    destructiveForeground: '210 40% 98%',
    border: '214.3 31.8% 91.4%',
    input: '214.3 31.8% 91.4%',
    ring: '221.2 83.2% 53.3%',
    chart1: '221.2 83.2% 53.3%', // Blue
    chart2: '142.1 76.2% 36.3%', // Green
    chart3: '346.8 77.2% 49.8%', // Red
    chart4: '47.9 95.8% 53.1%',  // Yellow
    chart5: '280.7 89.4% 65.3%', // Purple
    radius: '0.5rem',
  },

  // Blue Theme (Medical Professional)
  blue: {
    background: '0 0% 100%',
    foreground: '222.2 84% 4.9%',
    card: '0 0% 100%',
    cardForeground: '222.2 84% 4.9%',
    popover: '0 0% 100%',
    popoverForeground: '222.2 84% 4.9%',
    primary: '217.2 91.2% 59.8%', // Bright Blue
    primaryForeground: '210 40% 98%',
    secondary: '214.3 31.8% 91.4%',
    secondaryForeground: '222.2 47.4% 11.2%',
    muted: '214.3 31.8% 91.4%',
    mutedForeground: '215.4 16.3% 46.9%',
    accent: '214.3 31.8% 91.4%',
    accentForeground: '222.2 47.4% 11.2%',
    destructive: '0 84.2% 60.2%',
    destructiveForeground: '210 40% 98%',
    border: '214.3 31.8% 91.4%',
    input: '214.3 31.8% 91.4%',
    ring: '217.2 91.2% 59.8%',
    chart1: '217.2 91.2% 59.8%',
    chart2: '173 58% 39%',
    chart3: '350 89% 60%',
    chart4: '43 96% 56%',
    chart5: '262 83% 58%',
    radius: '0.5rem',
  },

  // Green Theme (Healthcare/Wellness)
  green: {
    background: '0 0% 100%',
    foreground: '222.2 84% 4.9%',
    card: '0 0% 100%',
    cardForeground: '222.2 84% 4.9%',
    popover: '0 0% 100%',
    popoverForeground: '222.2 84% 4.9%',
    primary: '142.1 76.2% 36.3%', // Medical Green
    primaryForeground: '210 40% 98%',
    secondary: '138.5 76.5% 96.7%',
    secondaryForeground: '222.2 47.4% 11.2%',
    muted: '138.5 76.5% 96.7%',
    mutedForeground: '215.4 16.3% 46.9%',
    accent: '138.5 76.5% 96.7%',
    accentForeground: '222.2 47.4% 11.2%',
    destructive: '0 84.2% 60.2%',
    destructiveForeground: '210 40% 98%',
    border: '214.3 31.8% 91.4%',
    input: '214.3 31.8% 91.4%',
    ring: '142.1 76.2% 36.3%',
    chart1: '142.1 76.2% 36.3%',
    chart2: '217.2 91.2% 59.8%',
    chart3: '350 89% 60%',
    chart4: '43 96% 56%',
    chart5: '262 83% 58%',
    radius: '0.5rem',
  },

  // Purple Theme (Government/Official)
  purple: {
    background: '0 0% 100%',
    foreground: '222.2 84% 4.9%',
    card: '0 0% 100%',
    cardForeground: '222.2 84% 4.9%',
    popover: '0 0% 100%',
    popoverForeground: '222.2 84% 4.9%',
    primary: '262.1 83.3% 57.8%', // Government Purple
    primaryForeground: '210 40% 98%',
    secondary: '270 60% 98.4%',
    secondaryForeground: '222.2 47.4% 11.2%',
    muted: '270 60% 98.4%',
    mutedForeground: '215.4 16.3% 46.9%',
    accent: '270 60% 98.4%',
    accentForeground: '222.2 47.4% 11.2%',
    destructive: '0 84.2% 60.2%',
    destructiveForeground: '210 40% 98%',
    border: '214.3 31.8% 91.4%',
    input: '214.3 31.8% 91.4%',
    ring: '262.1 83.3% 57.8%',
    chart1: '262.1 83.3% 57.8%',
    chart2: '142.1 76.2% 36.3%',
    chart3: '350 89% 60%',
    chart4: '43 96% 56%',
    chart5: '217.2 91.2% 59.8%',
    radius: '0.5rem',
  },

  // Dark Theme (Night Mode)
  dark: {
    background: '222.2 84% 4.9%',
    foreground: '210 40% 98%',
    card: '222.2 84% 4.9%',
    cardForeground: '210 40% 98%',
    popover: '222.2 84% 4.9%',
    popoverForeground: '210 40% 98%',
    primary: '217.2 91.2% 59.8%',
    primaryForeground: '222.2 47.4% 11.2%',
    secondary: '217.2 32.6% 17.5%',
    secondaryForeground: '210 40% 98%',
    muted: '217.2 32.6% 17.5%',
    mutedForeground: '215 20.2% 65.1%',
    accent: '217.2 32.6% 17.5%',
    accentForeground: '210 40% 98%',
    destructive: '0 62.8% 30.6%',
    destructiveForeground: '210 40% 98%',
    border: '217.2 32.6% 17.5%',
    input: '217.2 32.6% 17.5%',
    ring: '224.3 76.3% 48%',
    chart1: '220 70% 50%',
    chart2: '160 60% 45%',
    chart3: '30 80% 55%',
    chart4: '280 65% 60%',
    chart5: '340 75% 55%',
    radius: '0.5rem',
  },
};

export const themeLabels: Record<ThemeName, string> = {
  default: 'Hospital Blue',
  blue: 'Medical Blue',
  green: 'Healthcare Green',
  purple: 'Government Purple',
  dark: 'Dark Mode',
};
