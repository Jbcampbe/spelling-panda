import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function Lights({ shadows, mapSize }: { shadows: boolean; mapSize: number }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    if (l.shadow.mapSize.x !== mapSize) {
      l.shadow.mapSize.set(mapSize, mapSize);
      l.shadow.map?.dispose();
      l.shadow.map = null;
    }
  }, [mapSize]);
  return (
    <>
      <hemisphereLight args={['#fff3e6', '#a9c7a0', 0.9]} />
      <ambientLight intensity={0.16} color="#f3ecff" />
      <directionalLight
        ref={sun}
        position={[-6.5, 10, 4.5]}
        intensity={2.7}
        color="#fff1dc"
        castShadow={shadows}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      {/* Cool rim fill from behind for a soft toy-like edge light. */}
      <directionalLight position={[6, 4, -7]} intensity={0.6} color="#d8dcff" />
    </>
  );
}
