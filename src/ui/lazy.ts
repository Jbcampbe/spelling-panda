import { lazy } from 'react';

// R-PRF-P5: the 3D scene is loaded lazily, after the first screen renders.
export const loadWorld = () => import('../world/World');
export const World = lazy(loadWorld);
export const PandaPreview = lazy(() => import('../world/PandaPreview'));
