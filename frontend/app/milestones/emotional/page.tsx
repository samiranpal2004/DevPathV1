"use client";

import Link from "next/link";
import React, { useEffect, useState } from 'react';

export default function EmotionalStreak() {
  const [streakCount, setStreakCount] = useState(0);

  useEffect(() => {
    // Simple counter animation logic
    const target = 30;
    const duration = 1000;
    const startTime = performance.now();

    function updateCounter(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Simple easeOutQuad
        const easedProgress = progress * (2 - progress);
        const currentCount = Math.floor(easedProgress * target);
        
        setStreakCount(currentCount);

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            setStreakCount(target);
        }
    }

    // Small delay to start with the card entrance
    const timeout = setTimeout(() => {
        requestAnimationFrame(updateCounter);
    }, 400);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="bg-black font-body min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Overlay: Full-screen dark blur */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 animate-[fadeIn_0.5s_ease-out_forwards]"></div>
      
      {/* Main Milestone Card */}
      <div className="relative z-50 w-full max-w-[420px] bg-charcoal rounded-[2rem] shadow-2xl overflow-hidden border border-white/5 animate-[slideUp_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]">
        {/* Pulse Glow Effect */}
        <div className="absolute inset-0 opacity-0 pointer-events-none animate-[pulseGlow_2s_ease-in-out_forwards]" style={{ background: "radial-gradient(circle at center, rgba(255, 191, 0, 0.15) 0%, rgba(28, 28, 30, 0) 70%)" }}></div>
        
        <div className="relative p-8 flex flex-col items-center text-center">
          {/* Close Button (Ghost) */}
          <Link href="/dashboard" className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors group">
            <span className="material-symbols-outlined text-white/30 group-hover:text-white" data-icon="close">close</span>
          </Link>

          {/* 1. Row of amber flame icons */}
          <div className="flex gap-1.5 mb-8">
            <style>{`
              @keyframes staggerFade {
                0% { transform: scale(0.5); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
              }
              .flame-stagger {
                animation: staggerFade 0.4s ease-out forwards;
              }
              .flame-stagger:nth-child(1) { animation-delay: 0.1s; }
              .flame-stagger:nth-child(2) { animation-delay: 0.2s; }
              .flame-stagger:nth-child(3) { animation-delay: 0.3s; }
              .flame-stagger:nth-child(4) { animation-delay: 0.4s; }
              .flame-stagger:nth-child(5) { animation-delay: 0.5s; }
              .flame-stagger:nth-child(6) { animation-delay: 0.6s; }
              .flame-stagger:nth-child(7) { animation-delay: 0.7s; }
            `}</style>
            {[...Array(7)].map((_, i) => (
              <span key={i} className="material-symbols-outlined text-amber-glow text-2xl flame-stagger opacity-0" data-icon="local_fire_department">local_fire_department</span>
            ))}
          </div>

          {/* 2. Massive Ivory Number */}
          <div className="mb-2">
            <h1 className="font-headline font-extrabold text-[96px] leading-none text-ivory tracking-tighter counter-number" style={{ fontVariantNumeric: "tabular-nums" }}>
                {streakCount}
            </h1>
          </div>

          {/* 3. Day Streak Label */}
          <div className="mb-6">
            <span className="font-headline text-[13px] font-bold tracking-[0.3em] text-amber-glow/80 uppercase">
                DAY STREAK
            </span>
          </div>

          {/* 4. Motivational Message */}
          <p className="text-white/70 text-base font-medium max-w-[280px] mb-8">
              Two weeks in. You're building something real. Keep that momentum.
          </p>

          {/* 5. XP Bonus Pill */}
          <div className="mb-10">
            <div className="inline-flex items-center bg-amber-glow/10 px-4 py-2 rounded-full border border-amber-glow/20">
              <span className="material-symbols-outlined text-amber-glow mr-2 text-base" data-icon="stars">stars</span>
              <span className="font-headline text-xs font-bold text-amber-glow uppercase tracking-wider">+50 XP Milestone Bonus</span>
            </div>
          </div>

          {/* 6. Shareable Card Preview */}
          <div className="w-full bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col items-center gap-3 mb-8">
            <div className="w-[160px] h-[80px] bg-gradient-to-br from-charcoal to-black rounded-lg border border-white/10 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at center, rgba(255, 191, 0, 0.15) 0%, rgba(28, 28, 30, 0) 70%)" }}></div>
              <span className="text-ivory font-headline font-bold text-xl">30 DAYS</span>
            </div>
            <button className="flex items-center gap-2 text-xs font-bold text-white/50 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-sm" data-icon="ios_share">ios_share</span>
                  SHARE PERSONAL WIN
            </button>
          </div>

          {/* 7. Dismiss Link */}
          <button className="font-headline text-sm font-bold text-muted-teal hover:text-muted-teal/80 transition-all flex items-center gap-2 group">
              Continue my streak
              <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform" data-icon="arrow_forward">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
