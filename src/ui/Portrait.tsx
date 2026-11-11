import { useEffect, useState } from 'react';
import type { PandaColor } from '../types';
import { PandaFace } from './icons';

const cache = new Map<PandaColor, Promise<string>>();

function loadPortrait(color: PandaColor): Promise<string> {
  let p = cache.get(color);
  if (!p) {
    p = import('../world/portrait')
      .then((m) => m.getPandaPortrait(color))
      .catch(() => '');
    cache.set(color, p);
  }
  return p;
}

/** Rendered panda portrait, with a flat SVG face while it loads or if rendering fails. */
export default function Portrait({ color, size = 96 }: { color: PandaColor; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    void loadPortrait(color).then((s) => {
      if (alive) setSrc(s);
    });
    return () => {
      alive = false;
    };
  }, [color]);
  return (
    <span className="portrait" style={{ width: size, height: size }}>
      {src ? <img src={src} alt="" width={size} height={size} draggable={false} /> : <PandaFace color={color} size={size * 0.85} />}
    </span>
  );
}
