// Small set of UI primitives. Kept intentionally tight — we are NOT building a
// design system here. Dark theme, inline styles via StyleSheet, mirrors the
// web mockup's tone (deep blacks, lime accent, big tap targets).
//
// If this file grows past ~300 lines, split it. Don't pull in a UI library for
// this first pass.

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ---- Design tokens ---------------------------------------------------------

export const C = {
  bg: '#0A0A0A',
  bgElev: '#141414',
  card: '#1A1A1A',
  cardElev: '#222222',
  border: '#2A2A2A',
  borderStrong: '#3A3A3A',
  text: '#F5F5F5',
  textDim: '#A0A0A0',
  textMuted: '#6B6B6B',
  // Accents
  lime: '#C6F432',
  limeDark: '#9DC100',
  blue: '#3B82F6',
  amber: '#F59E0B',
  red: '#EF4444',
  green: '#22C55E',
} as const;

export const F = {
  // Font sizes — RN doesn't have a global font, so we just use numbers.
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 26,
  xxl: 34,
} as const;

export const R = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const S = {
  // Spacing scale, in pixels.
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// ---- Screen ---------------------------------------------------------------

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  loading = false,
  style,
}: ScreenProps) {
  const Container: React.ComponentType<any> = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={s.screenSafe} edges={['top', 'left', 'right']}>
      <Container
        style={[s.screen, style]}
        contentContainerStyle={
          scroll
            ? [padded ? s.screenContent : null, { flexGrow: 1 }]
            : undefined
        }
      >
        {!scroll && padded ? <View style={s.screenContent}>{children}</View> : children}
        {loading ? (
          <View style={s.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={C.lime} />
          </View>
        ) : null}
      </Container>
    </SafeAreaView>
  );
}

// ---- Card -----------------------------------------------------------------

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  title?: string;
  subtitle?: string;
}

export function Card({ children, style, onPress, title, subtitle }: CardProps) {
  const inner = (
    <>
      {title ? (
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>{title}</Text>
          {subtitle ? <Text style={s.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.card, style, pressed && s.cardPressed]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{inner}</View>;
}

// ---- Button ---------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  disabled = false,
  style,
  textStyle,
  ...rest
}: ButtonProps) {
  const variantStyle = s[`btn_${variant}` as const];
  const variantText = s[`btnText_${variant}` as const];
  const sizeStyle = s[`btnSize_${size}` as const];
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn,
        variantStyle,
        sizeStyle,
        disabled && s.btnDisabled,
        pressed && !disabled && s.btnPressed,
        style,
      ]}
    >
      <Text
        style={[
          s.btnText,
          variantText,
          size === 'lg' && { fontSize: F.md },
          size === 'sm' && { fontSize: F.sm },
          disabled && s.btnTextDisabled,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---- Tile (KPI block) -----------------------------------------------------

export interface TileProps {
  label: string;
  value: string | number;
  caption?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Tile({ label, value, caption, onPress, style }: TileProps) {
  const inner = (
    <>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue}>{value}</Text>
      {caption ? <Text style={s.tileCaption}>{caption}</Text> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.tile, style, pressed && s.cardPressed]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={[s.tile, style]}>{inner}</View>;
}

// ---- Badge ----------------------------------------------------------------

export type BadgeTone = 'neutral' | 'lime' | 'amber' | 'red' | 'green' | 'blue';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const toneStyle = s[`badge_${tone}` as const];
  const toneText = s[`badgeText_${tone}` as const];
  return (
    <View style={[s.badge, toneStyle, style]}>
      <Text style={[s.badgeText, toneText]}>{label}</Text>
    </View>
  );
}

// ---- Row utility ----------------------------------------------------------

export function Row({
  children,
  style,
  gap = S.sm,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return (
    <View style={[{ flexDirection: 'row', gap, alignItems: 'center' }, style]}>
      {children}
    </View>
  );
}

export function Spacer({ size = S.md }: { size?: number }) {
  return <View style={{ height: size }} />;
}

// ---- Heading --------------------------------------------------------------

export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.h2, style]}>{children}</Text>;
}
export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}
export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.body, style]}>{children}</Text>;
}

// ---- Styles ---------------------------------------------------------------

const s = StyleSheet.create({
  screenSafe: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg },
  screenContent: { padding: S.lg, gap: S.md },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: C.border,
    gap: S.sm,
  },
  cardPressed: { opacity: 0.7 },
  cardHeader: { gap: 2, marginBottom: S.xs },
  cardTitle: { color: C.text, fontSize: F.md, fontWeight: '600' },
  cardSubtitle: { color: C.textDim, fontSize: F.sm },

  // Button
  btn: {
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontWeight: '600', fontSize: F.base },
  btnTextDisabled: {},
  btnSize_sm: { paddingVertical: S.sm, paddingHorizontal: S.md, minHeight: 36 },
  btnSize_md: { paddingVertical: S.md, paddingHorizontal: S.lg, minHeight: 48 },
  btnSize_lg: { paddingVertical: S.lg, paddingHorizontal: S.xl, minHeight: 60 },
  btn_primary: { backgroundColor: C.lime },
  btnText_primary: { color: '#0A0A0A' },
  btn_secondary: { backgroundColor: C.cardElev, borderWidth: 1, borderColor: C.borderStrong },
  btnText_secondary: { color: C.text },
  btn_ghost: { backgroundColor: 'transparent' },
  btnText_ghost: { color: C.text },
  btn_danger: { backgroundColor: C.red },
  btnText_danger: { color: '#fff' },

  // Tile
  tile: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.lg,
    borderWidth: 1,
    borderColor: C.border,
    flex: 1,
    gap: 2,
    minWidth: 130,
  },
  tileLabel: { color: C.textDim, fontSize: F.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  tileValue: { color: C.text, fontSize: F.xl, fontWeight: '700' },
  tileCaption: { color: C.textMuted, fontSize: F.sm },

  // Badge
  badge: {
    paddingHorizontal: S.sm,
    paddingVertical: 3,
    borderRadius: R.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: F.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  badge_neutral: { backgroundColor: C.cardElev, borderWidth: 1, borderColor: C.border },
  badgeText_neutral: { color: C.textDim },
  badge_lime: { backgroundColor: 'rgba(198, 244, 50, 0.16)' },
  badgeText_lime: { color: C.lime },
  badge_amber: { backgroundColor: 'rgba(245, 158, 11, 0.18)' },
  badgeText_amber: { color: C.amber },
  badge_red: { backgroundColor: 'rgba(239, 68, 68, 0.18)' },
  badgeText_red: { color: C.red },
  badge_green: { backgroundColor: 'rgba(34, 197, 94, 0.18)' },
  badgeText_green: { color: C.green },
  badge_blue: { backgroundColor: 'rgba(59, 130, 246, 0.18)' },
  badgeText_blue: { color: C.blue },

  // Type
  h1: { color: C.text, fontSize: F.xxl, fontWeight: '700' },
  h2: { color: C.text, fontSize: F.lg, fontWeight: '600' },
  muted: { color: C.textDim, fontSize: F.sm },
  body: { color: C.text, fontSize: F.base },
});
