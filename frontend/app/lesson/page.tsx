import Link from "next/link";
import React from 'react';

export default function LessonOverlay() {
  return (
    <div className="text-on-background overflow-hidden h-screen flex flex-col bg-surface">
      {/* TopNavBar - Predictive Shell Component */}
      <nav className="fixed top-0 w-full z-50 bg-[#fafaf5]/70 backdrop-blur-[20px] shadow-[0_20px_50px_rgba(63,72,73,0.06)]">
        <div className="flex justify-between items-center px-8 h-16 w-full max-w-[1440px] mx-auto">
          <div className="flex items-center gap-8">
            <span className="text-xl font-black text-primary font-headline tracking-tight">DevPath</span>
            <div className="hidden md:flex gap-6 items-center">
              <Link className="font-headline font-bold tracking-tight text-primary border-b-2 border-primary pb-1" href="/dashboard">Dashboard</Link>
              <Link className="font-headline font-bold tracking-tight text-on-surface-variant hover:text-primary transition-all duration-300" href="/room">Rooms</Link>
              <Link className="font-headline font-bold tracking-tight text-on-surface-variant hover:text-primary transition-all duration-300" href="/heatmap">Heatmap</Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-tertiary bg-secondary-container px-3 py-1 rounded-full">Streak: 12 🔥</span>
            <span className="text-sm font-medium text-on-surface-variant opacity-60">2,450 XP</span>
            <button className="material-symbols-outlined text-on-surface-variant active:scale-95 transition-transform" data-icon="notifications">notifications</button>
            <div className="h-8 w-8 rounded-full bg-surface-container-highest overflow-hidden">
              <img alt="User profile avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9lE7zkg2rZu1pm3xzgniZk1IkNl18pvccYJgcrhrA2h8M2zhVc1tqPghsVkVWRQ2d4jeGK1MPopgx7-lUIVgi4T30CJn6ZWxXHRfdoBuGIHVsI42X6Hd0_N8-SFIjWfIqK0nBX_j_7Tr80Hxt8gXAT_gP3qoSKPSuXpf-_Cpto5pAyx7bQ2OWwdRf2PBBWp73Lc0aZvSPEwKYcQ6tfldn8DbvfLfg4afmDb3VRaE5I44GvqkvrjgnGwctlCO7gLY-s7ZD3VtZXgEP" />
            </div>
          </div>
        </div>
        <div className="bg-surface-container-low h-[1px] w-full absolute bottom-0 opacity-20"></div>
      </nav>

      {/* Main Content Canvas (Editor Simulation) */}
      <main className="flex-grow pt-16 flex overflow-hidden">
        {/* SideNav - Desktop Shell */}
        <aside className="hidden lg:flex flex-col py-6 px-4 w-64 bg-surface-container-low h-full shrink-0">
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-surface-container-lowest text-primary rounded-full shadow-sm hover:translate-x-1 transition-transform">
              <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
              <span className="font-headline text-sm font-semibold">Dashboard</span>
            </div>
            <div className="flex items-center gap-3 p-3 text-on-surface-variant hover:bg-surface-variant/50 rounded-full hover:translate-x-1 transition-transform">
              <span className="material-symbols-outlined" data-icon="groups">groups</span>
              <span className="font-headline text-sm font-semibold">Rooms</span>
            </div>
            <div className="flex items-center gap-3 p-3 text-on-surface-variant hover:bg-surface-variant/50 rounded-full hover:translate-x-1 transition-transform">
              <span className="material-symbols-outlined" data-icon="calendar_view_month">calendar_view_month</span>
              <span className="font-headline text-sm font-semibold">Heatmap</span>
            </div>
          </div>
          <div className="mt-auto space-y-4">
            <button className="w-full py-3 bg-primary text-on-primary rounded-full font-headline font-bold text-sm tracking-wide shadow-lg active:scale-95 transition-all">Start Lesson</button>
            <div className="space-y-1">
              <div className="flex items-center gap-3 p-3 text-on-surface-variant hover:bg-surface-variant/50 rounded-full text-xs font-semibold cursor-pointer">
                <span className="material-symbols-outlined text-sm" data-icon="settings">settings</span>
                <span>Settings</span>
              </div>
              <div className="flex items-center gap-3 p-3 text-on-surface-variant hover:bg-surface-variant/50 rounded-full text-xs font-semibold cursor-pointer">
                <span className="material-symbols-outlined text-sm" data-icon="help_outline">help_outline</span>
                <span>Support</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Simulated Coding Workspace */}
        <div className="flex-grow p-8 bg-surface-container-lowest overflow-auto">
          <div className="max-w-4xl mx-auto space-y-8 opacity-40 grayscale pointer-events-none">
            <h1 className="text-4xl font-headline font-extrabold tracking-tighter">Day 14: Recursive Patterns</h1>
            <div className="p-8 bg-surface-container rounded-lg border-t-2 border-primary/20">
              <div className="flex gap-4 mb-6">
                <div className="w-3 h-3 rounded-full bg-error/40"></div>
                <div className="w-3 h-3 rounded-full bg-tertiary/40"></div>
                <div className="w-3 h-3 rounded-full bg-primary/40"></div>
              </div>
              <div className="font-mono text-sm space-y-2 opacity-60">
                <p>function findFactorial(n) {"{"}</p>
                <p className="pl-4">if (n === 1) return 1;</p>
                <p className="pl-4">return n * findFact(n - 1);</p>
                <p>{"}"}</p>
                <p className="mt-4 text-error">Uncaught ReferenceError: findFact is not defined</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Micro-lesson Overlay (The Task) */}
      <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-on-background/10 backdrop-blur-sm">
        <div className="w-full md:max-w-2xl bg-surface-bright shadow-[0_20px_50px_rgba(63,72,73,0.06)] rounded-t-xl md:rounded-lg overflow-hidden flex flex-col md:animate-[slideUp_0.3s_ease-out]">
          {/* Modal Header */}
          <div className="bg-primary-container/20 p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-3xl" data-icon="lightbulb" style={{fontVariationSettings: "'FILL' 1"}}>lightbulb</span>
              </div>
              <div>
                <h2 className="font-headline font-extrabold text-2xl tracking-tight text-on-background">Let's fix this.</h2>
                <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest opacity-60">Stuck Detection: Reference Error</p>
              </div>
            </div>
            <Link href="/dashboard" className="material-symbols-outlined text-on-surface-variant/40 hover:text-on-surface-variant" data-icon="close">close</Link>
          </div>

          {/* Modal Body */}
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <p className="font-headline text-lg font-medium text-on-surface-variant leading-relaxed">
                It looks like you're trying to call a function named <span className="bg-secondary-container px-1.5 py-0.5 rounded text-on-secondary-container font-mono text-sm">findFact</span>, but your function definition is actually named <span className="bg-primary/10 px-1.5 py-0.5 rounded text-primary font-mono text-sm">findFactorial</span>.
              </p>
              <p className="font-headline text-lg font-medium text-on-surface-variant leading-relaxed">
                In recursion, the function must call <span className="italic font-bold text-on-background">itself</span> exactly as defined to continue the loop.
              </p>
            </div>

            {/* Code Block */}
            <div className="bg-inverse-surface rounded-xl p-6 shadow-[0_20px_50px_rgba(63,72,73,0.06)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1/2 h-[2px] bg-tertiary shadow-[0_0_8px_#cba72f]"></div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-mono text-inverse-on-surface/40 uppercase tracking-widest">Corrected Implementation</span>
                <span className="material-symbols-outlined text-inverse-on-surface/40 text-sm" data-icon="content_copy">content_copy</span>
              </div>
              <pre className="font-mono text-sm leading-6">
                <span className="text-[#92d2d3]">function</span> <span className="text-[#ffe088]">findFactorial</span>(n) {"{\n"}
                <span className="text-[#bfc8c8]">  // Base case</span>{"\n"}
                <span className="text-[#92d2d3]">  if</span> (n === <span className="text-[#e9c349]">1</span>) <span className="text-[#92d2d3]">return</span> <span className="text-[#e9c349]">1</span>;{"\n\n"}
                <span className="text-[#bfc8c8]">  // Recursive call (Must match function name)</span>{"\n"}
                <span className="text-[#92d2d3]">  return</span> n * <span className="text-[#ffe088]">findFactorial</span>(n - <span className="text-[#e9c349]">1</span>);{"\n"}
                {"}"}
              </pre>
            </div>

            {/* Footer Action */}
            <div className="pt-4">
              <button className="w-full py-5 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full font-headline font-extrabold text-lg tracking-tight shadow-[0_20px_50px_rgba(63,72,73,0.06)] hover:brightness-105 active:scale-[0.98] transition-all">
                Got it, try again.
              </button>
              <p className="text-center mt-4 font-body text-xs text-on-surface-variant/50">
                Need more help? <span className="text-primary font-bold cursor-pointer hover:underline">Open full lesson</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
