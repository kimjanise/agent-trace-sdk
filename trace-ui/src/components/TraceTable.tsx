"use client";

import { Trace } from "@/types/trace";
import { ChevronRight } from "lucide-react";

interface TraceTableProps {
  traces: Trace[];
  selectedTraceId: string | null;
  onSelectTrace: (trace: Trace) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center px-3 py-1.5 text-[11px] font-semibold tracking-wide rounded-md bg-[#d1fae5] text-[#065f46]">
          COMPLETED
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center px-3 py-1.5 text-[11px] font-semibold tracking-wide rounded-md bg-[#fee2e2] text-[#dc2626]">
          ERROR
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-3 py-1.5 text-[11px] font-semibold tracking-wide rounded-md bg-[#fef3c7] text-[#d97706]">
          {status.toUpperCase()}
        </span>
      );
  }
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  return `${ms} ms`;
}


export default function TraceTable({
  traces,
  selectedTraceId,
  onSelectTrace,
}: TraceTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e5e7eb] text-left">
            <th className="px-4 py-3 text-[13px] font-semibold text-[#4b5563] uppercase tracking-wide w-10"></th>
            <th className="px-4 py-3 text-[13px] font-semibold text-[#4b5563] uppercase tracking-wide">
              ID
            </th>
            <th className="px-4 py-3 text-[13px] font-semibold text-[#4b5563] uppercase tracking-wide">
              Agent Name
            </th>
            <th className="px-4 py-3 text-[13px] font-semibold text-[#4b5563] uppercase tracking-wide">
              Input
            </th>
            <th className="px-4 py-3 text-[13px] font-semibold text-[#4b5563] uppercase tracking-wide">
              Output
            </th>
            <th className="px-4 py-3 text-[13px] font-semibold text-[#4b5563] uppercase tracking-wide">
              Status
            </th>
            <th className="px-4 py-3 text-[13px] font-semibold text-[#4b5563] uppercase tracking-wide">
              Total Duration
            </th>
            <th className="px-4 py-3 text-[13px] font-semibold text-[#4b5563] uppercase tracking-wide">
              Tokens
            </th>
            <th className="px-4 py-3 text-[13px] font-semibold text-[#4b5563] uppercase tracking-wide">
              Tool Errors
            </th>
          </tr>
        </thead>
        <tbody>
          {traces.map((trace, index) => (
            <tr
              key={trace.trace_id}
              onClick={() => onSelectTrace(trace)}
              className={`
                border-b border-[#f3f4f6] cursor-pointer transition-colors
                ${selectedTraceId === trace.trace_id
                  ? "bg-[#eef2ff]"
                  : "hover:bg-[#f9fafb]"
                }
              `}
            >
              <td className="px-4 py-2.5">
                <ChevronRight className="w-5 h-5 text-[#9ca3af]" />
              </td>
              <td className="px-4 py-2.5 text-[15px] font-medium text-[#374151]">
                {traces.length - 1 - index}
              </td>
              <td className="px-4 py-2.5 text-[15px] font-medium text-[#1f2937]">
                {trace.agent_name}
              </td>
              <td className="px-4 py-2.5 max-w-[200px]">
                <span className="block text-[15px] text-[#6b7280] truncate whitespace-nowrap overflow-hidden">
                  {trace.input || "—"}
                </span>
              </td>
              <td className="px-4 py-2.5 max-w-[200px]">
                <span className="block text-[15px] text-[#6b7280] truncate whitespace-nowrap overflow-hidden">
                  {trace.output || "—"}
                </span>
              </td>
              <td className="px-4 py-2.5">
                {getStatusBadge(trace.status)}
              </td>
              <td className="px-4 py-2.5 text-[15px] text-[#6b7280]">
                {formatDuration(trace.duration_ms)}
              </td>
              <td className="px-4 py-2.5 text-[15px] text-[#6b7280]">
                {trace.total_tokens}
              </td>
              <td className="px-4 py-2.5">
                {trace.tool_error_count !== undefined && trace.tool_error_count > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-md bg-[#fee2e2] text-[#dc2626]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {trace.tool_error_count}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-md bg-[#d1fae5] text-[#065f46]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    0
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {traces.length === 0 && (
        <div className="text-center py-24 text-[16px] text-[#6b7280]">
          No traces found. Run an agent to see traces here.
        </div>
      )}
    </div>
  );
}
