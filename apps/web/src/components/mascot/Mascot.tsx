'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { MASCOT_STATES, POSES, type MascotState } from './states';
import './mascot.css';

interface MascotProps {
  state: MascotState;
  /** Spoken text shown in a speech bubble. Always visible, so audio is never the only channel. */
  line?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Mascot({ state, line, size = 'md', className = '' }: MascotProps) {
  useEffect(() => {
    for (const s of MASCOT_STATES) new window.Image().src = `/mascot/${s}.webp`;
  }, []);

  const pose = POSES[state];
  return (
    <figure className={`mascot ${className}`} data-size={size}>
      <div aria-live="polite" className="mascot-line">
        {line ? <p className="mascot-bubble">{line}</p> : null}
      </div>
      <div className="mascot-stage">
        <Image key={state} src={`/mascot/${state}.webp`} alt={pose.alt} width={pose.width} height={pose.height} priority={state === 'idle'} className="mascot-art" data-state={state} />
      </div>
    </figure>
  );
}
