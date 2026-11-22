'use client';

import dynamic from 'next/dynamic';
import type { PetaRuteProps } from './peta-rute-inner';

const PetaRuteDynamic = dynamic(() => import('./peta-rute-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full rounded-xl border border-[#E6E8F0] bg-[#F8FAFF] animate-pulse flex items-center justify-center text-xs font-semibold text-[#77788A]">
      Memuat peta rute...
    </div>
  ),
});

export type { PetaRuteProps };

export function PetaRute(props: PetaRuteProps) {
  return <PetaRuteDynamic {...props} />;
}

export default PetaRute;
