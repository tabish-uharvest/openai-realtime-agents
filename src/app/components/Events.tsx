"use client";

import React, { useRef, useEffect, useState } from "react";
import { useEvent } from "@/app/contexts/EventContext";
import { LoggedEvent } from "@/app/types";

export interface EventsProps {
  isExpanded: boolean;
}

function Events({ isExpanded }: EventsProps) {
  const [prevEventLogs, setPrevEventLogs] = useState<LoggedEvent[]>([]);
  const eventLogsContainerRef = useRef<HTMLDivElement | null>(null);

  const { loggedEvents, toggleExpand } = useEvent();

  const getDirectionArrow = (direction: string) => {
    if (direction === "client") return { symbol: "▲", color: "#7f5af0" };
    if (direction === "server") return { symbol: "▼", color: "#2cb67d" };
    return { symbol: "•", color: "#555" };
  };

  useEffect(() => {
    const hasNewEvent = loggedEvents.length > prevEventLogs.length;

    if (isExpanded && hasNewEvent && eventLogsContainerRef.current) {
      eventLogsContainerRef.current.scrollTop =
        eventLogsContainerRef.current.scrollHeight;
    }

    setPrevEventLogs(loggedEvents);
  }, [loggedEvents, isExpanded]);

  return (
    <div className="bg-gray-50 rounded-lg border overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 border-b">
        <span className="font-medium text-gray-700 text-sm">Debug Events</span>
      </div>
      <div className="max-h-48 overflow-y-auto p-2">
        {loggedEvents.slice(-10).map((log, idx) => {
          const arrowInfo = getDirectionArrow(log.direction);
          const isError =
            log.eventName.toLowerCase().includes("error") ||
            log.eventData?.response?.status_details?.error != null;

          return (
            <div
              key={`${log.id}-${idx}`}
              className="border-b border-gray-200 py-2 font-mono"
            >
              <div
                onClick={() => toggleExpand(log.id)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center flex-1">
                  <span
                    style={{ color: arrowInfo.color }}
                    className="ml-1 mr-2 text-xs"
                  >
                    {arrowInfo.symbol}
                  </span>
                  <span
                    className={
                      "flex-1 text-xs " +
                      (isError ? "text-red-600" : "text-gray-800")
                    }
                  >
                    {log.eventName}
                  </span>
                </div>
                <div className="text-gray-500 ml-1 text-xs whitespace-nowrap">
                  {log.timestamp}
                </div>
              </div>

              {log.expanded && log.eventData && (
                <div className="text-gray-800 text-left">
                  <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                    {JSON.stringify(log.eventData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Events;
