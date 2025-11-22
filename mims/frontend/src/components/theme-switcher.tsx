'use client';

import { useTheme } from '@/providers/theme-provider';
import { themeLabels, ThemeName } from '@/lib/theme-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Palette } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme, availableThemes } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <Palette className="h-4 w-4 text-muted-foreground" />
      <Select value={theme} onValueChange={(value: string) => setTheme(value as ThemeName)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
          {availableThemes.map((themeName) => (
            <SelectItem key={themeName} value={themeName}>
              {themeLabels[themeName]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
