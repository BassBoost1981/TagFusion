/**
 * Liquid Glass Spring Animation Presets
 * Based on iOS 26 / WWDC 2025 Design Guidelines
 * 
 * Spring physics create the "gel-like" feel of Liquid Glass
 */

import type { Transition, Variants } from 'framer-motion';

// ============================================
// SPRING PRESETS (iOS-style physics)
// ============================================

/** Bouncy spring - for playful interactions */
export const springBouncy: Transition = {
  type: 'spring',
  damping: 15,
  stiffness: 300,
  mass: 0.8,
};

/** Snappy spring - for quick, responsive feedback */
export const springSnappy: Transition = {
  type: 'spring',
  damping: 25,
  stiffness: 400,
  mass: 0.5,
};

/** Gentle spring - for subtle, elegant motion */
export const springGentle: Transition = {
  type: 'spring',
  damping: 30,
  stiffness: 200,
  mass: 1,
};

/** Default spring - balanced for most interactions */
export const springDefault: Transition = {
  type: 'spring',
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};

/** Slow spring - for dramatic reveals */
export const springSlow: Transition = {
  type: 'spring',
  damping: 35,
  stiffness: 150,
  mass: 1.2,
};

// ============================================
// GLASS BUTTON VARIANTS
// ============================================

export const glassButtonVariants: Variants = {
  initial: {
    scale: 1,
    y: 0,
  },
  hover: {
    scale: 1.02,
    y: -1,
    transition: springSnappy,
  },
  tap: {
    scale: 0.97,
    y: 1,
    transition: { type: 'spring', damping: 30, stiffness: 500 },
  },
};

// ============================================
// GLASS CARD VARIANTS
// ============================================

export const glassCardVariants: Variants = {
  initial: {
    scale: 1,
    y: 0,
    opacity: 1,
  },
  hover: {
    scale: 1.01,
    y: -2,
    transition: springGentle,
  },
  tap: {
    scale: 0.99,
    transition: springSnappy,
  },
};

// ============================================
// FADE & SLIDE VARIANTS
// ============================================

export const fadeInUp: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: springDefault,
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.15 },
  },
};

export const fadeInScale: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: springBouncy,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.1 },
  },
};

// ============================================
// STAGGER CHILDREN
// ============================================

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.15,
    },
  },
};

export const staggerItem: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      ...springDefault,
      duration: 0.4,
    },
  },
};

