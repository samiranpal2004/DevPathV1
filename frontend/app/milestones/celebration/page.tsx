import Link from "next/link";
import React from 'react';

export default function StreakCelebration() {
  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Subtle Detail */}
      <div className="fixed top-12 left-12 opacity-20 pointer-events-none">
          <span className="font-headline font-black text-9xl text-primary-container leading-none select-none">PATH</span>
      </div>
      <div className="fixed bottom-12 right-12 opacity-20 pointer-events-none">
          <span className="font-headline font-black text-9xl text-primary-container leading-none select-none">DEV</span>
      </div>

      {/* Modal Overlay Backdrop */}
      <div className="fixed inset-0 bg-surface-dim/80 backdrop-blur-md z-40"></div>

      {/* Main Milestone Card */}
      <div className="relative z-50 w-full max-w-2xl bg-surface-container-low rounded-lg shadow-[0_20px_50px_rgba(63,72,73,0.06)] overflow-hidden border border-outline-variant/10">
        
        {/* The Streak Line (Signature Component) */}
        <div className="absolute top-0 left-0 w-full h-[2px] shadow-[0_0_8px_rgba(115,92,0,0.4)]" style={{ background: "linear-gradient(90deg, transparent, #735c00, transparent)" }}></div>
        
        {/* Close Button */}
        <Link href="/dashboard" className="absolute top-6 right-6 p-2 rounded-full hover:bg-surface-container-high transition-colors group">
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-on-surface" data-icon="close">close</span>
        </Link>

        {/* Card Content with Radial Glow */}
        <div className="p-12 flex flex-col items-center text-center" style={{ background: "radial-gradient(circle at center, rgba(233, 195, 73, 0.15) 0%, rgba(244, 244, 241, 0) 70%)" }}>
          
          {/* Top Label */}
          <div className="mb-12">
            <span className="font-headline text-xs font-bold tracking-[0.2em] text-primary uppercase">
                STREAK MILESTONE
            </span>
          </div>

          {/* Achievement Display */}
          <div className="flex flex-col items-center mb-8">
            <h1 className="font-headline font-extrabold text-[120px] leading-none text-primary tracking-tighter mb-2">
                7
            </h1>
            <span className="font-headline text-lg font-bold tracking-[0.4em] text-on-surface-variant uppercase">
                DAYS
            </span>
          </div>

          {/* Streak Flame Row */}
          <div className="flex gap-4 mb-10">
            {[...Array(7)].map((_, i) => (
              <span key={i} className="material-symbols-outlined text-tertiary text-3xl drop-shadow-[0_0_8px_rgba(115,92,0,0.3)]" data-icon="local_fire_department" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
            ))}
          </div>

          {/* Message & Reward */}
          <div className="max-w-sm mb-12">
            <p className="text-on-surface-variant text-lg font-body mb-6">
                You've shown up every single day. That's rare.
            </p>
            {/* XP Bonus Chip */}
            <div className="inline-flex items-center bg-secondary-container px-6 py-2 rounded-full border border-secondary/10">
              <span className="material-symbols-outlined text-primary mr-2 text-sm" data-icon="stars" style={{fontVariationSettings: "'FILL' 1"}}>stars</span>
              <span className="font-headline text-sm font-bold text-primary">+50 XP Bonus Earned</span>
            </div>
          </div>

          {/* Share Section */}
          <div className="w-full pt-10 border-t border-outline-variant/20">
            <p className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase mb-6">BRAG A LITTLE</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {/* Instagram Ghost Button */}
              <button className="flex items-center justify-center gap-2 px-8 py-3 rounded-full border border-primary text-primary font-headline text-sm font-bold hover:bg-primary/5 transition-all duration-300">
                <span className="material-symbols-outlined text-lg" data-icon="photo_camera">photo_camera</span>
                Share on Instagram
              </button>
              {/* WhatsApp Ghost Button */}
              <button className="flex items-center justify-center gap-2 px-8 py-3 rounded-full border border-primary text-primary font-headline text-sm font-bold hover:bg-primary/5 transition-all duration-300">
                <span className="material-symbols-outlined text-lg" data-icon="chat">chat</span>
                Share on WhatsApp
              </button>
            </div>
          </div>
        </div>
        
        {/* Decorative Corners */}
        <div className="absolute bottom-0 right-0 w-32 h-32 opacity-10 pointer-events-none">
          <img alt="Abstract geometry background" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwJvWzZd3tOByYKt5rBSNnbZgrlYHGS2AH8dZ-0Zi7SED47xCiDDLwCLzJ_X1B8J6c_IHayisO9kpDBPJSHsiQeQHClEgXJNKVJR3fiPb1VHyVTm9SyA-G8ZBS27KFRswQ-aukknxv1pOFhLv0YC8fjq7RkYClCFlKjbKKv8YugQMNjyHr0AFwSVIqgl0E_QwTVT0efnAXanX9qeETAw1NZGIPaA9082TNvsVxtcrGFNxwDNud44I1cpEmvMsnX0D1cvMHSZnKfso_" />
        </div>
      </div>
    </div>
  );
}
