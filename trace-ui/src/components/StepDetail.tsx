"use client";

import { TreeNode, Trace, LLMCall, ToolExecution } from "@/types/trace";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface StepDetailProps {
  node: TreeNode;
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[#e5e7eb]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-[#f9fafb] transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-[#9ca3af]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#9ca3af]" />
        )}
        {icon}
        <span className="text-[13px] font-medium text-[#1f2937]">{title}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function JsonSyntaxHighlight({ data }: { data: unknown }) {
  const jsonString = JSON.stringify(data, null, 2);

  // Simple syntax highlighting
  const highlighted = jsonString
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: "([^"]*)"([,\n])/g, ': <span class="json-string">"$1"</span>$2')
    .replace(/: (\d+)([,\n])/g, ': <span class="json-number">$1</span>$2')
    .replace(/: (true|false)([,\n])/g, ': <span class="json-boolean">$1</span>$2')
    .replace(/: (null)([,\n])/g, ': <span class="json-null">$1</span>$2');

  return (
    <div>
      <select className="galileo-select text-[12px] mb-3">
        <option>JSON</option>
      </select>
      <pre
        className="code-block text-[13px] text-[#1f2937]"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}

function getIcon(type: string) {
  switch (type) {
    case "agent":
      return (
        <div className="w-5 h-5 rounded bg-[#eef2ff] flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-[#6366f1]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      );
    case "llm":
      return (
        <div className="w-5 h-5 rounded bg-[#fef3c7] flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-[#d97706]" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </div>
      );
    case "tool":
      return (
        <div className="w-5 h-5 rounded bg-[#d1fae5] flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-[#059669]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
          </svg>
        </div>
      );
    default:
      return null;
  }
}

function AgentDetail({ data }: { data: Trace }) {
  return (
    <>
      <CollapsibleSection title="Input">
        <JsonSyntaxHighlight data={{ content: data.input }} />
      </CollapsibleSection>

      <CollapsibleSection title="Output">
        <JsonSyntaxHighlight data={{ content: data.output }} />
      </CollapsibleSection>

      {data.error && (
        <CollapsibleSection title="Error">
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 text-[13px] text-[#dc2626]">
            {data.error}
          </div>
        </CollapsibleSection>
      )}
    </>
  );
}

function LLMDetail({ data }: { data: LLMCall }) {
  return (
    <>
      <CollapsibleSection title="Input">
        <JsonSyntaxHighlight data={data.request_messages || []} />
      </CollapsibleSection>

      <CollapsibleSection title="Output">
        {data.response_content ? (
          <>
            <div className="text-[11px] text-[#6b7280] uppercase mb-2">Text</div>
            <div className="code-block text-[13px] text-[#1f2937] whitespace-pre-wrap">
              {data.response_content}
            </div>
          </>
        ) : data.response_tool_calls && data.response_tool_calls.length > 0 ? (
          <JsonSyntaxHighlight data={data.response_tool_calls} />
        ) : (
          <div className="text-[13px] text-[#6b7280]">No output</div>
        )}
      </CollapsibleSection>
    </>
  );
}

function ToolDetail({ data }: { data: ToolExecution }) {
  return (
    <>
      <CollapsibleSection title="Input">
        <JsonSyntaxHighlight data={data.arguments || {}} />
      </CollapsibleSection>

      <CollapsibleSection title="Output">
        {data.error ? (
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-md p-3 text-[13px] text-[#dc2626]">
            {data.error}
          </div>
        ) : (
          <JsonSyntaxHighlight data={{ result: data.result }} />
        )}
      </CollapsibleSection>
    </>
  );
}

export default function StepDetail({ node }: StepDetailProps) {
  return (
    <div className="h-full overflow-y-auto bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-[#e5e7eb] px-4 py-3 z-10">
        <div className="flex items-center gap-3">
          {getIcon(node.type)}
          <span className="text-[14px] font-medium text-[#1f2937]">
            {node.type === "agent" ? "Session" : node.type === "llm" ? "llm" : node.name}
          </span>
          {node.type === "llm" && (
            <span className="text-[13px] text-[#6b7280]">{node.name}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div>
        {node.type === "agent" && <AgentDetail data={node.data as Trace} />}
        {node.type === "llm" && <LLMDetail data={node.data as LLMCall} />}
        {node.type === "tool" && <ToolDetail data={node.data as ToolExecution} />}
      </div>
    </div>
  );
}
