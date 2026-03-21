import Link from "next/link";
import React from 'react';

export default function MagicalAchievement() {
  return (
    <div className="bg-surface font-body text-on-surface antialiased overflow-hidden">
      {/* Backdrop */}
      <div className="relative min-h-screen w-full flex items-center justify-center p-6 overflow-hidden">
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-md z-40"></div>

        <style>{`
          @keyframes modal-entrance {
            0% { transform: scale(0.7); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes badge-drop {
            0% { transform: translateY(-40px) scale(0.5); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes confetti-pop {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes particle-fly {
            0% { transform: translate(0, 0) rotate(0); opacity: 1; }
            100% { transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)); opacity: 0; }
          }
          @keyframes pulse-glow {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(1.3); opacity: 0.6; }
          }
          @keyframes spin-slow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .animate-modal-entrance { animation: modal-entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          .animate-badge-drop { animation: badge-drop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards; }
          .animate-confetti-pop { animation: confetti-pop 0.5s ease-out 0.3s forwards; }
          .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
          .animate-spin-slow { animation: spin-slow 8s linear infinite; }
          .confetti-particle {
            position: absolute;
            width: 6px;
            height: 6px;
            border-radius: 2px;
            opacity: 0;
            animation: particle-fly 1.2s ease-out 0.3s forwards;
          }
          .hex-shape { clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); }
        `}</style>

        {/* The Magical Modal Card */}
        <div className="relative z-50 w-full max-w-[400px] animate-modal-entrance opacity-0">
          <div className="bg-magical-teal rounded-lg shadow-[0_0_50px_rgba(255,191,0,0.15)] border border-white/15 p-10 flex flex-col items-center text-center overflow-hidden">
            
            {/* Confetti Burst Container */}
            <div className="absolute inset-x-0 top-0 h-32 pointer-events-none flex justify-center items-center overflow-visible animate-confetti-pop opacity-0">
              {/* Dynamic Particle Simulation Mock */}
              <div className="confetti-particle bg-magical-gold" style={{ '--tw-translate-x': '-60px', '--tw-translate-y': '-40px', '--tw-rotate': '45deg' } as React.CSSProperties}></div>
              <div className="confetti-particle bg-magical-amber" style={{ '--tw-translate-x': '40px', '--tw-translate-y': '-70px', '--tw-rotate': '-30deg' } as React.CSSProperties}></div>
              <div className="confetti-particle bg-magical-ivory" style={{ '--tw-translate-x': '-80px', '--tw-translate-y': '-80px', '--tw-rotate': '120deg' } as React.CSSProperties}></div>
              <div className="confetti-particle bg-primary-container" style={{ '--tw-translate-x': '90px', '--tw-translate-y': '-50px', '--tw-rotate': '15deg' } as React.CSSProperties}></div>
              <div className="confetti-particle bg-magical-gold" style={{ '--tw-translate-x': '-30px', '--tw-translate-y': '-100px', '--tw-rotate': '200deg' } as React.CSSProperties}></div>
              <div className="confetti-particle bg-magical-amber" style={{ '--tw-translate-x': '10px', '--tw-translate-y': '-90px', '--tw-rotate': '-150deg' } as React.CSSProperties}></div>
              <div className="confetti-particle bg-magical-ivory" style={{ '--tw-translate-x': '70px', '--tw-translate-y': '-110px', '--tw-rotate': '80deg' } as React.CSSProperties}></div>
              <div className="confetti-particle bg-primary-container" style={{ '--tw-translate-x': '-110px', '--tw-translate-y': '-60px', '--tw-rotate': '-45deg' } as React.CSSProperties}></div>
            </div>

            {/* Close Icon */}
            <Link href="/dashboard" className="absolute top-6 right-6 text-magical-ivory/40 hover:text-magical-ivory transition-colors">
              <span className="material-symbols-outlined text-xl">close</span>
            </Link>

            {/* Top Label */}
            <span className="font-headline font-bold text-[11px] tracking-[0.3em] text-magical-ivory mb-12">✦ ACHIEVEMENT UNLOCKED ✦</span>

            {/* Badge Container */}
            <div className="relative mb-10 animate-badge-drop opacity-0">
              {/* Soft Radial Gold Pulse */}
              <div className="absolute inset-0 bg-magical-gold/20 blur-[50px] rounded-full scale-125 animate-pulse-glow"></div>
              {/* Rotating Dashed Ring */}
              <div className="absolute -inset-4 border-2 border-dashed border-magical-gold/30 rounded-full animate-spin-slow"></div>
              {/* 96px Hexagonal Badge */}
              <div className="relative w-24 h-24 hex-shape bg-gradient-to-br from-magical-gold to-magical-amber flex items-center justify-center shadow-[0_0_30px_rgba(255,191,0,0.4)]">
                <div className="w-[92%] h-[92%] hex-shape bg-magical-teal/20 flex items-center justify-center backdrop-blur-sm">
                  <span className="material-symbols-outlined text-white text-4xl" style={{fontVariationSettings: "'FILL' 1"}}>bolt</span>
                </div>
              </div>
            </div>

            {/* Text Content */}
            <h1 className="font-headline text-2xl font-bold text-magical-ivory mb-2">Week Warrior</h1>
            <p className="text-white/60 text-sm font-medium mb-6 max-w-[260px] leading-relaxed">You completed a 7-day streak and maintained your momentum.</p>

            {/* XP Reward Chip */}
            <div className="inline-flex items-center bg-magical-amber px-4 py-1.5 rounded-full mb-10">
              <span className="text-xs font-extrabold text-magical-teal tracking-wide">+50 XP</span>
            </div>

            {/* CTA Button */}
            <button className="group w-full flex items-center justify-center gap-2 bg-magical-amber text-magical-teal px-8 py-4 rounded-xl font-headline font-extrabold text-sm shadow-xl shadow-magical-amber/10 hover:brightness-105 active:scale-[0.98] transition-all duration-200">
                Claim Reward
                <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      {/* Decorative Streak Progress */}
      <div className="fixed top-0 left-0 w-full h-[4px] bg-magical-amber z-50 shadow-[0_0_15px_rgba(255,191,0,0.5)]"></div>
    </div>
  );
}
