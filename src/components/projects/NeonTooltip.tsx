import { createPortal } from "react-dom";

interface NeonTooltipProps {
    tooltip: { text: string; x: number; y: number } | null;
}

export function NeonTooltip({ tooltip }: NeonTooltipProps) {
    if (!tooltip) return null;

    // Ajustar posición para que no se salga de la pantalla
    const isTooFarRight = tooltip.x > window.innerWidth - 320;
    const isTooFarBottom = tooltip.y > window.innerHeight - 100;

    const left = isTooFarRight ? tooltip.x - 320 : tooltip.x + 15;
    const top = isTooFarBottom ? tooltip.y - 100 : tooltip.y + 15;

    return createPortal(
        <div 
            className="fixed z-[9999] pointer-events-none"
            style={{ top, left, maxWidth: '300px', width: 'max-content' }}
        >
            <div className="relative overflow-hidden rounded-xl border-2 border-[#00f3ff] bg-[#020617] p-4 text-sm font-bold text-white shadow-[0_0_15px_rgba(0,243,255,0.6),inset_0_0_15px_rgba(0,243,255,0.4)]">
                {/* Scanlines effect */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(0,243,255,0.1)0px,rgba(0,243,255,0.1)_2px,transparent_2px,transparent_4px)] pointer-events-none opacity-50 mix-blend-screen"></div>
                
                {/* Glow effect overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,243,255,0.2)] to-transparent pointer-events-none"></div>

                <div 
                    className="relative z-10 break-words font-sans tracking-wide" 
                    style={{ 
                        textShadow: '0 0 4px rgba(0,243,255,0.8), 0 0 8px rgba(0,243,255,0.5)',
                        lineHeight: '1.5'
                    }}
                >
                    {tooltip.text}
                </div>
            </div>
        </div>,
        document.body
    );
}
