"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { VideoMission } from "@/components/VideoMission";
import { ActiveMission } from "@/components/ActiveMission";
import { useActiveRoom } from "@/hooks/useActiveRoom";

function RoomEntrySection() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-white font-bold text-lg mb-1">Rooms</h2>
      <p className="text-gray-400 text-sm mb-5">Race with friends through the same daily plan.</p>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => router.push('/rooms/create')}
          className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors"
        >
          + Create Room
        </button>

        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="Enter code (e.g. KGEC42)"
            className="flex-1 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-600 font-mono focus:outline-none focus:border-green-500 transition-colors"
          />
          <button
            onClick={() => {
              if (joinCode.length === 6) {
                router.push(`/join/${joinCode}`);
              }
            }}
            disabled={joinCode.length !== 6}
            className="px-5 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const { activeRoom } = useActiveRoom();
console.log('Active room:', activeRoom);

  return (
    <>
      <Navbar />
      
      <main className="pt-32 pb-24 px-8 max-w-[1200px] mx-auto">
        {/* Greeting Section */}
        <header className="mb-12 relative">
          <div className="absolute -top-12 -left-12 w-64 h-64 bg-primary-container/5 blur-[100px] rounded-full pointer-events-none"></div>
          <h1 className="text-5xl font-extrabold text-on-background tracking-tight mb-2">Good morning, {user?.firstName ?? 'Learner'}.</h1>
          <p className="text-lg text-on-surface-variant max-w-xl">Your focus path is ready. Complete today's mission to maintain your 12-day momentum.</p>
        </header>

        {/* Active room banner */}
        {activeRoom && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <div>
                <p className="text-white font-semibold text-sm">{activeRoom.name}</p>
                <p className="text-green-400 text-xs">Complete your tasks to climb the leaderboard</p>
              </div>
            </div>
            <Link
              href={`/rooms/${activeRoom.id}`}
              className="text-green-400 text-xs font-medium hover:text-green-300 transition-colors bg-green-500/20 px-3 py-1.5 rounded-lg"
            >
              View Race →
            </Link>
          </div>
        )}

        {/* YouTube URL input — paste link to generate tasks */}
        <VideoMission />

        {/* Active Mission — real data from /api/mission/today */}
        <ActiveMission />

        {/* Rooms entry point */}
        <section className="mt-8">
          <RoomEntrySection />
        </section>

        {/* Low Profile Heatmap Strip */}
        <footer className="mt-20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-on-surface-variant/40 tracking-[0.2em] uppercase">Consistency Map</h3>
            <span className="text-[10px] text-on-surface-variant/40">Past 90 Days</span>
          </div>
          <div className="bg-surface-container-low/50 rounded-lg p-4 flex gap-1 justify-between items-end h-12 overflow-hidden">
            {/* Mock heatmap bars */}
            {Array.from({length: 30}).map((_, i) => (
              <div key={i} className={`w-full ${['bg-primary/20', 'bg-primary/40', 'bg-tertiary/60', 'bg-primary/80'][i%4]} h-${[2,4,6,8,3,5][i%6]} rounded-full`}></div>
            ))}
          </div>
          
          <div className="mt-8 flex justify-between items-center text-[11px] font-medium text-on-surface-variant/50 border-t border-outline-variant/10 pt-4">
            <span>© 2024 DevPath. Systems Nominal.</span>
            <div className="flex gap-4">
              <a className="hover:text-primary transition-colors" href="#">Terms</a>
              <a className="hover:text-primary transition-colors" href="#">Privacy</a>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Status: Online</span>
            </div>
          </div>
        </footer>
      </main>

    </>
  );
}
