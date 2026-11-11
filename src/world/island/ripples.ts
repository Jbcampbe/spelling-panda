/** Shared state for the pond's swimmer ripples (read by the water shader). */
import * as THREE from 'three';
import { POND } from './layout';

export const MAX_SWIMMERS = 4;
/**
 * Swimming pandas, written by the herd every frame: x, y = position in the water plane's
 * own space (island x - pond x, pond z - island z), z = ripple strength 0..1.
 */
export const pondSwimmers: THREE.Vector3[] = Array.from({ length: MAX_SWIMMERS }, () => new THREE.Vector3());

/** Set swimmer slot `i` from an island-space position. */
export function setPondSwimmer(i: number, x: number, z: number, strength: number): void {
  if (i < MAX_SWIMMERS) pondSwimmers[i].set(x - POND.x, POND.z - z, strength);
}
