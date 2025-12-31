"use client";

import { useEffect, useState } from "react";
import { Trace } from "@/types/trace";
import { getTraces } from "@/lib/supabase";
import TraceTable from "@/components/TraceTable";
import TraceDetailPanel from "@/components/TraceDetailPanel";
import {
  ChevronRight,
  Share2,
  Settings,
  RefreshCw,
  Filter
} from "lucide-react";

export default function Home() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTraces() {
    setLoading(true);
    setError(null);
    try {
      const data = await getTraces();
      setTraces(data);
    } catch (err) {
      console.error("Error loading traces:", err);
      setError("Failed to load traces. Check your Supabase configuration.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTraces();
  }, []);

  const selectedIndex = selectedTrace
    ? traces.findIndex((t) => t.trace_id === selectedTrace.trace_id)
    : -1;

  function handleNavigate(direction: "prev" | "next") {
    if (selectedIndex === -1) return;
    const newIndex = direction === "prev" ? selectedIndex - 1 : selectedIndex + 1;
    if (newIndex >= 0 && newIndex < traces.length) {
      setSelectedTrace(traces[newIndex]);
    }
  }

  return (
    <main className="min-h-screen bg-[#f9fafb]">
      {/* Top Header Bar - Galileo style */}
      <header className="bg-white border-b border-[#e5e7eb]">
        <div className="flex items-center justify-between px-4 h-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-[#6b7280] hover:text-[#1f2937] cursor-pointer">
              AgentTrace
            </span>
            <ChevronRight className="w-4 h-4 text-[#9ca3af]" />
            <span className="text-[#6b7280] hover:text-[#1f2937] cursor-pointer">
              Log Stream: DefaultStream
            </span>
            <ChevronRight className="w-4 h-4 text-[#9ca3af]" />
            <span className="text-[#1f2937] font-medium">
              All Sessions
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={loadTraces}
              disabled={loading}
              className="flex items-center gap-2 text-[13px] text-[#6b7280] hover:text-[#1f2937] px-3 py-1.5 rounded hover:bg-[#f3f4f6] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button className="flex items-center gap-2 text-[13px] text-[#6b7280] hover:text-[#1f2937] px-3 py-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Header with Tabs */}
      <div className="bg-white border-b border-[#e5e7eb]">
        <div className="flex items-center justify-between px-4">
          {/* Tabs */}
          <div className="flex items-center">
            <button className="tab active">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Messages
            </button>
            <button className="tab">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Latency
            </button>
            <button className="tab">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Trace graph
            </button>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-[#6b7280]">
              {traces.length} sessions
            </span>
            <button className="btn-primary flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configure Metrics
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex">
        {/* Main Table Section */}
        <div className="flex-1 p-4">
          {/* Filter bar */}
          <div className="bg-white rounded-lg border border-[#e5e7eb] mb-4">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#e5e7eb]">
              <Filter className="w-4 h-4 text-[#9ca3af]" />
              <span className="text-[13px] text-[#6b7280]">Filter by</span>
              <div className="flex-1" />
              <span className="text-[13px] text-[#6b7280]">
                Displaying {traces.length} out of {traces.length}
              </span>
            </div>

            {/* Error message */}
            {error && (
              <div className="px-4 py-3 bg-[#fef2f2] border-b border-[#fecaca] text-[#dc2626] text-[13px]">
                {error}
              </div>
            )}

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#e5e7eb] border-t-[#6366f1]"></div>
              </div>
            ) : (
              <TraceTable
                traces={traces}
                selectedTraceId={selectedTrace?.trace_id || null}
                onSelectTrace={setSelectedTrace}
              />
            )}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedTrace && (
        <TraceDetailPanel
          trace={selectedTrace}
          onClose={() => setSelectedTrace(null)}
          traceIndex={selectedIndex}
          totalTraces={traces.length}
          onNavigate={handleNavigate}
        />
      )}
    </main>
  );
}
