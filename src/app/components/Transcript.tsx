"use-client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TranscriptItem } from "@/app/types";
import Image from "next/image";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { DownloadIcon, ClipboardCopyIcon } from "@radix-ui/react-icons";
import { GuardrailChip } from "./GuardrailChip";

export interface TranscriptProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  downloadRecording: () => void;
  onCopyTranscript?: () => void;
  agentType?: 'restaurant' | 'showroom';
}

function Transcript({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  downloadRecording,
  onCopyTranscript,
  agentType = 'restaurant',
}: TranscriptProps) {
  const { transcriptItems, toggleTranscriptItemExpand } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);
  const [justCopied, setJustCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((newItem, index) => {
      const oldItem = prevLogs[index];
      return (
        oldItem &&
        (newItem.title !== oldItem.title || newItem.data !== oldItem.data)
      );
    });

    if (hasNewMessage || hasUpdatedMessage) {
      scrollToBottom();
    }

    setPrevLogs(transcriptItems);
  }, [transcriptItems]);

  // Autofocus on text box input on load
  useEffect(() => {
    if (canSend && inputRef.current) {
      inputRef.current.focus();
    }
  }, [canSend]);

  const handleCopyTranscript = async () => {
    if (!transcriptRef.current) return;
    try {
      await navigator.clipboard.writeText(transcriptRef.current.innerText);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy transcript:", error);
    }
  };

  // Expose copy function to parent
  useEffect(() => {
    if (onCopyTranscript) {
      (window as any).handleTranscriptCopy = handleCopyTranscript;
    }
  }, [onCopyTranscript]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Transcript Content */}
        <div
          ref={transcriptRef}
          className="overflow-auto flex flex-col gap-y-4 h-full transcript-content selectable-text"
        >
          {[...transcriptItems]
            .sort((a, b) => a.createdAtMs - b.createdAtMs)
            .map((item) => {
              const {
                itemId,
                type,
                role,
                data,
                expanded,
                timestamp,
                title = "",
                isHidden,
                guardrailResult,
              } = item;

            if (isHidden) {
              return null;
            }

            if (type === "MESSAGE") {
              const isUser = role === "user";
              const containerClasses = `flex justify-end flex-col ${
                isUser ? "items-end" : "items-start"
              }`;
              const bubbleBase = `max-w-lg p-4 rounded-xl shadow-md ${
                isUser 
                  ? "bg-green-800 text-white" 
                  : "bg-white text-gray-800 border-2 border-blue-200"
              }`;
              const isBracketedMessage =
                title.startsWith("[") && title.endsWith("]");
              const messageStyle = isBracketedMessage
                ? 'italic text-gray-400'
                : '';
              const displayTitle = isBracketedMessage
                ? title.slice(1, -1)
                : title;

              return (
                <div key={itemId} className={containerClasses}>
                  <div className="max-w-lg">
                    <div
                      className={`${bubbleBase} rounded-t-xl ${
                        guardrailResult ? "" : "rounded-b-xl"
                      }`}
                    >
                      <div
                        className={`text-xs ${
                          isUser ? "text-gray-400" : "text-gray-500"
                        } font-mono`}
                      >
                        {timestamp}
                      </div>
                      <div className={`whitespace-pre-wrap ${messageStyle}`}>
                        <ReactMarkdown>{displayTitle}</ReactMarkdown>
                      </div>
                    </div>
                    {guardrailResult && (
                      <div className="bg-gray-200 px-3 py-2 rounded-b-xl">
                        <GuardrailChip guardrailResult={guardrailResult} />
                      </div>
                    )}
                  </div>
                </div>
              );
            } else if (type === "BREADCRUMB") {
              return (
                <div
                  key={itemId}
                  className="flex flex-col justify-start items-start text-gray-500 text-sm"
                >
                  <span className="text-xs font-mono">{timestamp}</span>
                  <div
                    className={`whitespace-pre-wrap flex items-center font-mono text-sm text-gray-800 ${
                      data ? "cursor-pointer" : ""
                    }`}
                    onClick={() => data && toggleTranscriptItemExpand(itemId)}
                  >
                    {data && (
                      <span
                        className={`text-gray-400 mr-1 transform transition-transform duration-200 select-none font-mono ${
                          expanded ? "rotate-90" : "rotate-0"
                        }`}
                      >
                        ▶
                      </span>
                    )}
                    {title}
                  </div>
                  {expanded && data && (
                    <div className="text-gray-800 text-left">
                      <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            } else {
              // Fallback if type is neither MESSAGE nor BREADCRUMB
              return (
                <div
                  key={itemId}
                  className="flex justify-center text-gray-500 text-sm italic font-mono"
                >
                  Unknown item type: {type}{" "}
                  <span className="ml-2 text-xs">{timestamp}</span>
                </div>
              );
            }
          })}
          
          {/* Welcome Message if no conversation yet */}
          {transcriptItems.length === 0 && (
            <div className="text-center py-12">
              <div className="flex justify-center mb-6">
                <div className={`w-20 h-20 bg-white rounded-full flex items-center justify-center p-2 shadow-lg border-4 ${
                  agentType === 'showroom' ? 'border-blue-200' : 'border-yellow-200'
                }`}>
                  <Image 
                    src={agentType === 'showroom' ? "/hyundai_logo.svg" : "/uh_logo.svg"}
                    alt={agentType === 'showroom' ? "Hyundai Capital Showroom Logo" : "UrbanHarvest Zaika Logo"}
                    width={60} 
                    height={60}
                    className="w-14 h-14"
                  />
                </div>
              </div>
              <h3 className={`text-xl font-bold mb-2 ${
                agentType === 'showroom' ? 'text-blue-800' : 'text-green-800'
              }`}>
                {agentType === 'showroom' 
                  ? 'Welcome to Hyundai Capital Showroom!' 
                  : 'Welcome to UrbanHarvest Zaika!'}
              </h3>
              <p className="text-gray-600 mb-4">
                {agentType === 'showroom'
                  ? 'Start your car consultation by clicking "Start Car Consultation" above, or type your message below.'
                  : 'Start your voice order by clicking "Start Voice Order" above, or type your message below.'}
              </p>
              <div className={`border-2 rounded-lg p-4 max-w-md mx-auto ${
                agentType === 'showroom' 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <p className={`text-sm ${
                  agentType === 'showroom' ? 'text-blue-800' : 'text-green-800'
                }`}>
                  <strong>Try saying:</strong> {
                    agentType === 'showroom'
                      ? '"Hello, I\'m looking for a new car" or "Tell me about Hyundai SUVs"'
                      : '"Namaste, I\'d like to order food" or "Ek masala dosa chahiye"'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`p-4 flex items-center gap-x-3 flex-shrink-0 border-t-2 bg-white rounded-b-lg ${
        agentType === 'showroom' ? 'border-blue-200' : 'border-yellow-200'
      }`}>
        <input
          ref={inputRef}
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) {
              onSendMessage();
            }
          }}
          className="flex-1 px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 text-base min-h-[48px]"
          placeholder="Type your order or message here..."
        />
        <button
          onClick={onSendMessage}
          disabled={!canSend || !userText.trim()}
          className="showroom-button disabled:opacity-50 disabled:cursor-not-allowed px-4 py-4 min-h-[48px] min-w-[48px]"
        >
          <Image src="arrow.svg" alt="Send" width={20} height={20} />
        </button>
      </div>
    </div>
  );
}

export default Transcript;
