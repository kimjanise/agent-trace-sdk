"use client";

import { useEffect, useState } from "react";
import { Trace } from "@/types/trace";
import { getTraces } from "@/lib/supabase";
import TraceTable from "@/components/TraceTable";
import TraceDetailPanel from "@/components/TraceDetailPanel";
import {
  RefreshCw,
  Filter
} from "lucide-react";
import Image from "next/image";
import erisLogo from "@/assets/eris.png";

export default function Home() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterName, setFilterName] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  async function loadTraces() {
    setLoading(true);
    setError(null);
    try {
      const data = await getTraces();
      setTraces(data);
    } catch {
      setError("Failed to load traces. Check your Supabase configuration.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTraces();
  }, []);

  // Filter traces
  const filteredTraces = traces.filter((trace) => {
    const matchesName = filterName === "" ||
      trace.agent_name.toLowerCase().includes(filterName.toLowerCase());
    const matchesStatus = filterStatus === "all" || trace.status === filterStatus;
    return matchesName && matchesStatus;
  });

  const selectedIndex = selectedTrace
    ? filteredTraces.findIndex((t) => t.trace_id === selectedTrace.trace_id)
    : -1;

  function handleNavigate(direction: "prev" | "next") {
    if (selectedIndex === -1) return;
    const newIndex = direction === "prev" ? selectedIndex - 1 : selectedIndex + 1;
    if (newIndex >= 0 && newIndex < filteredTraces.length) {
      setSelectedTrace(filteredTraces[newIndex]);
    }
  }

  return (
    <main className="min-h-screen bg-[#f9fafb]">
      {/* Header */}
      <div className="bg-white border-b border-[#e5e7eb]">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo */}
          <Image
            src={erisLogo}
            alt="Eris"
            height={28}
            className="w-auto"
          />

          {/* Right side */}
          <div className="flex items-center gap-5">
            <span className="text-[14px] text-[#6b7280]">
              {filteredTraces.length} sessions
            </span>
            <button
              onClick={loadTraces}
              disabled={loading}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-3 py-1.5 rounded-md text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
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
            <div className="flex items-center gap-4 px-4 py-3 border-b border-[#e5e7eb]">
              <Filter className="w-4 h-4 text-[#9ca3af]" />
              <span className="text-[13px] text-[#6b7280]">Filter by</span>

              {/* Name filter */}
              <input
                type="text"
                placeholder="Agent name..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="px-3 py-1.5 text-[13px] border border-[#e5e7eb] rounded-md focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent w-40"
              />

              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-[13px] border border-[#e5e7eb] rounded-md focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent bg-white"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="error">Error</option>
                <option value="active">Active</option>
              </select>

              {(filterName || filterStatus !== "all") && (
                <button
                  onClick={() => {
                    setFilterName("");
                    setFilterStatus("all");
                  }}
                  className="text-[13px] text-[#6366f1] hover:text-[#4f46e5]"
                >
                  Clear filters
                </button>
              )}

              <div className="flex-1" />
              <span className="text-[13px] text-[#6b7280]">
                Displaying {filteredTraces.length} out of {traces.length}
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
                traces={filteredTraces}
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
          totalTraces={filteredTraces.length}
          onNavigate={handleNavigate}
        />
      )}
    </main>
  );
}
