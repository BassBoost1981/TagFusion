/**
 * 3D Transform Utilities for TagFusion
 * Provides helper functions for 3D effects and transformations
 */

/**
 * Calculate 3D tilt based on mouse position
 * @param mouseX - Mouse X position (0-1, where 0.5 is center)
 * @param mouseY - Mouse Y position (0-1, where 0.5 is center)
 * @param maxTilt - Maximum tilt angle in degrees
 * @returns Object with rotateX and rotateY values
 */
export function calculateTilt(
  mouseX: number,
  mouseY: number,
  maxTilt: number = 15
): { rotateX: number; rotateY: number } {
  const tiltX = (mouseY - 0.5) * maxTilt;
  const tiltY = (mouseX - 0.5) * -maxTilt;
  return { rotateX: tiltX, rotateY: tiltY };
}

/**
 * Calculate parallax offset based on mouse position
 * @param mouseX - Mouse X position (0-1)
 * @param mouseY - Mouse Y position (0-1)
 * @param depth - Depth factor (higher = more movement)
 * @returns Object with x and y offset values
 */
export function calculateParallax(mouseX: number, mouseY: number, depth: number = 10): { x: number; y: number } {
  const x = (mouseX - 0.5) * depth;
  const y = (mouseY - 0.5) * depth;
  return { x, y };
}

/**
 * Generate 3D transform string
 * @param rotateX - Rotation around X axis in degrees
 * @param rotateY - Rotation around Y axis in degrees
 * @param rotateZ - Rotation around Z axis in degrees
 * @param translateZ - Translation along Z axis in pixels
 * @returns CSS transform string
 */
export function generate3DTransform(
  rotateX: number = 0,
  rotateY: number = 0,
  rotateZ: number = 0,
  translateZ: number = 0
): string {
  return `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) translateZ(${translateZ}px)`;
}

/**
 * Calculate depth-based shadow
 * @param depth - Depth level ('near' | 'mid' | 'far')
 * @param color - Shadow color (defaults to black)
 * @returns CSS box-shadow string
 */
export function getDepthShadow(depth: 'near' | 'mid' | 'far', color: string = '0,0,0'): string {
  const shadows = {
    near: `0 8px 32px rgba(${color},0.3), 0 2px 8px rgba(${color},0.2)`,
    mid: `0 4px 16px rgba(${color},0.2), 0 1px 4px rgba(${color},0.15)`,
    far: `0 2px 8px rgba(${color},0.1), 0 1px 2px rgba(${color},0.08)`,
  };
  return shadows[depth];
}

/**
 * Calculate glow effect based on color
 * @param color - Glow color ('cyan' | 'purple' | 'pink')
 * @param intensity - Glow intensity (0-1)
 * @returns CSS box-shadow string
 */
export function getGlowEffect(color: 'cyan' | 'purple' | 'pink', intensity: number = 0.4): string {
  const colors = {
    cyan: `6,182,212`,
    purple: `139,92,246`,
    pink: `236,72,153`,
  };
  const rgb = colors[color];
  return `0 0 30px rgba(${rgb},${intensity}), 0 0 60px rgba(${rgb},${intensity * 0.5})`;
}

/**
 * Create isometric transform for folder icons
 * @param angle - Rotation angle in degrees
 * @returns CSS transform string
 */
export function createIsometricTransform(angle: number = 45): string {
  return `rotateX(${angle}deg) rotateY(-30deg) rotateZ(0deg)`;
}

/**
 * Ease out cubic function for smooth animations
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease in out cubic function for smooth animations
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Spring animation configuration presets
 */
export const springPresets = {
  smooth: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 25,
    mass: 0.5,
  },
  bouncy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 15,
    mass: 0.8,
  },
  gentle: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 30,
    mass: 0.5,
  },
  snappy: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 20,
    mass: 0.3,
  },
};
