import {
  Rocket,
  Target,
  Bug,
  Lightbulb,
  Wrench,
  Megaphone,
  Calendar,
  FileText,
  Zap,
  Star,
  Flag,
  Package,
  Code2,
  Palette,
  Globe,
  ShoppingCart,
  TrendingUp,
  Shield,
  Heart,
  Coffee,
  Camera,
  Music,
  BookOpen,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';

// Курируемый набор — свободный текст в БД (0018_icon_and_priority.sql),
// но на фронте выбор только из этого списка. Добавлять новые иконки — просто
// дописать сюда, миграция не нужна (нет check-constraint на icon).
export const ICON_NAMES = [
  'Rocket',
  'Target',
  'Bug',
  'Lightbulb',
  'Wrench',
  'Megaphone',
  'Calendar',
  'FileText',
  'Zap',
  'Star',
  'Flag',
  'Package',
  'Code2',
  'Palette',
  'Globe',
  'ShoppingCart',
  'TrendingUp',
  'Shield',
  'Heart',
  'Coffee',
  'Camera',
  'Music',
  'BookOpen',
  'Briefcase',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const ICON_MAP: Record<IconName, LucideIcon> = {
  Rocket,
  Target,
  Bug,
  Lightbulb,
  Wrench,
  Megaphone,
  Calendar,
  FileText,
  Zap,
  Star,
  Flag,
  Package,
  Code2,
  Palette,
  Globe,
  ShoppingCart,
  TrendingUp,
  Shield,
  Heart,
  Coffee,
  Camera,
  Music,
  BookOpen,
  Briefcase,
};

export function resolveIcon(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  return ICON_MAP[name as IconName] ?? null;
}

export function isIconName(name: string | null | undefined): name is IconName {
  return !!name && Object.prototype.hasOwnProperty.call(ICON_MAP, name);
}
