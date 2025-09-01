"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";

// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import { FullscreenButton } from "./components/FullscreenButton";
import { RobotNavigationStatus } from "./components/RobotNavigationStatus";
import { RobotAPITester } from "./components/RobotAPITester";

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from '@openai/agents/realtime';

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { restaurantOrderScenario, restaurantOrderCompanyName } from "@/app/agentConfigs/restaurantOrder";
import { hyundaiShowroomScenario, hyundaiShowroomCompanyName } from "@/app/agentConfigs/hyundaiShowroom";

// Map used by connect logic for scenarios defined via the SDK.
const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  restaurantOrder: restaurantOrderScenario,
  hyundaiShowroom: hyundaiShowroomScenario,
};

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";

function App() {
  const searchParams = useSearchParams()!;

  // ---------------------------------------------------------------------
  // Codec selector – lets you toggle between wide-band Opus (48 kHz)
  // and narrow-band PCMU/PCMA (8 kHz) to hear what the agent sounds like on
  // a traditional phone line and to validate ASR / VAD behaviour under that
  // constraint.
  //
  // We read the `?codec=` query-param and rely on the `changePeerConnection`
  // hook (configured in `useRealtimeSession`) to set the preferred codec
  // before the offer/answer negotiation.
  // ---------------------------------------------------------------------
  const urlCodec = searchParams.get("codec") || "opus";

  // Agents SDK doesn't currently support codec selection so it is now forced 
  // via global codecPatch at module load 

  const {
    addTranscriptMessage,
    addTranscriptBreadcrumb,
  } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    RealtimeAgent[] | null
  >(null);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  // Ref to identify whether the latest agent switch came from an automatic handoff
  const handoffTriggeredRef = useRef(false);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  // Attach SDK audio element once it exists (after first render in browser)
  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  const {
    isSecureContext,
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    interrupt,
    mute,
  } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      setSelectedAgentName(agentName);
    },
  });

  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return true;
      const stored = localStorage.getItem('audioPlaybackEnabled');
      return stored ? stored === 'true' : true;
    },
  );

  // Initialize the recording hook.
  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

  useHandleSessionHistory();

  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(!handoffTriggeredRef.current);
      // Reset flag after handling so subsequent effects behave normally
      handoffTriggeredRef.current = false;
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      updateSession();
    }
  }, [isPTTActive]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get("agentConfig") || "default";
    if (sdkScenarioMap[agentSetKey]) {
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");

      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;

        // Ensure the selectedAgentName is first so that it becomes the root
        const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
        const idx = reorderedAgents.findIndex((a) => a.name === selectedAgentName);
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }

        const companyName = agentSetKey === 'hyundaiShowroom' ? hyundaiShowroomCompanyName : restaurantOrderCompanyName;
        const guardrail = createModerationGuardrail(companyName);

        await connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: reorderedAgents,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: {
            addTranscriptBreadcrumb,
          },
        });
      } catch (error: any) {
        console.error('Connection failed:', error);
        setSessionStatus("DISCONNECTED");
        
        // Show user-friendly error message
        alert(
          '🚨 Connection Failed\n\n' +
          (error.message?.includes('HTTPS or localhost') 
            ? '🔒 Realtime voice features require a secure connection.\n\n' +
              '✅ Solutions:\n' +
              '• Use http://localhost:3002 (recommended for development)\n' +
              '• Or setup HTTPS for LAN access\n\n' +
              '🔧 Current URL: ' + window.location.href
            : 'Failed to connect to voice assistant: ' + (error.message || error)
          )
        );
      }
    }
  };

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent({
      type: 'conversation.item.create',
      item: {
        id,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    sendClientEvent({ type: 'response.create' }, '(simulated user text message)');
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    // Reflect Push-to-Talk UI state by (de)activating server VAD on the
    // backend. The Realtime SDK supports live session updates via the
    // `session.update` event.
    const turnDetection = isPTTActive
      ? null
      : {
          type: 'server_vad',
          threshold: 0.9,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        };

    sendEvent({
      type: 'session.update',
      session: {
        turn_detection: turnDetection,
      },
    });

    // Send an initial 'hi' message to trigger the agent to greet the user
    if (shouldTriggerResponse) {
      sendSimulatedUserMessage('hi');
    }
    return;
  }

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    interrupt();

    try {
      sendUserText(userText.trim());
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }

    setUserText("");
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== 'CONNECTED') return;
    interrupt();

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: 'input_audio_buffer.clear' }, 'clear PTT buffer');

    // No placeholder; we'll rely on server transcript once ready.
  };

  const handleTalkButtonUp = () => {
    if (sessionStatus !== 'CONNECTED' || !isPTTUserSpeaking)
      return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: 'input_audio_buffer.commit' }, 'commit PTT');
    sendClientEvent({ type: 'response.create' }, 'trigger response PTT');
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      connectToRealtime();
    }
  };

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentConfig = e.target.value;
    const url = new URL(window.location.toString());
    url.searchParams.set("agentConfig", newAgentConfig);
    window.location.replace(url.toString());
  };

  const handleSelectedAgentChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newAgentName = e.target.value;
    // Reconnect session with the newly selected agent as root so that tool
    // execution works correctly.
    disconnectFromRealtime();
    setSelectedAgentName(newAgentName);
    // connectToRealtime will be triggered by effect watching selectedAgentName
  };

  // Because we need a new connection, refresh the page when codec changes
  const handleCodecChange = (newCodec: string) => {
    const url = new URL(window.location.toString());
    url.searchParams.set("codec", newCodec);
    window.location.replace(url.toString());
  };

  useEffect(() => {
    const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
    if (storedPushToTalkUI) {
      setIsPTTActive(storedPushToTalkUI === "true");
    }
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded) {
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    }
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pushToTalkUI", isPTTActive.toString());
  }, [isPTTActive]);

  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);

  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        // Mute and pause to avoid brief audio blips before pause takes effect.
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    // Toggle server-side audio stream mute so bandwidth is saved when the
    // user disables playback. 
    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn('Failed to toggle SDK mute', err);
    }
  }, [isAudioPlaybackEnabled]);

  // Ensure mute state is propagated to transport right after we connect or
  // whenever the SDK client reference becomes available.
  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn('mute sync after connect failed', err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      // The remote audio stream from the audio element.
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }

    // Clean up on unmount or when sessionStatus is updated.
    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  const agentSetKey = searchParams.get("agentConfig") || "default";
  
  // Dynamic branding based on agent
  const isHyundaiShowroom = agentSetKey === 'hyundaiShowroom';
  const headerConfig = isHyundaiShowroom ? {
    title: 'Hyundai Capital Showroom',
    subtitle: 'PAVS Assistant',
    logo: '/hyundai_logo.svg',
    primaryColor: 'blue',
    accentColor: 'blue'
  } : {
    title: 'UrbanHarvest Zaika',
    subtitle: 'Voice Ordering System',
    logo: '/uh_logo.svg',
    primaryColor: 'green',
    accentColor: 'yellow'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 touch-friendly-app">
      {/* Global Touch-Friendly Styles */}
      <style jsx global>{`
        .touch-friendly-app {
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        
        /* Allow text selection only in specific areas */
        .touch-friendly-app input,
        .touch-friendly-app textarea,
        .touch-friendly-app [contenteditable],
        .touch-friendly-app .selectable-text {
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          user-select: text;
        }
        
        /* Touch-friendly buttons */
        .touch-friendly-app button {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          min-height: 44px;
          min-width: 44px;
        }
        
        .touch-friendly-app button:active {
          transform: scale(0.95);
          transition: transform 0.1s ease;
        }
        
        /* Transcript text should be selectable */
        .touch-friendly-app .transcript-content {
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          user-select: text;
        }
      `}</style>
      {/* Dynamic Header */}
      <header className={isHyundaiShowroom ? "showroom-header" : "restaurant-header"}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1 shadow-md">
                  <Image 
                    src={headerConfig.logo} 
                    alt={`${headerConfig.title} Logo`} 
                    width={32} 
                    height={32}
                    className="w-8 h-8"
                  />
                </div>
                <div>
                  <h1 className={`text-2xl font-bold ${isHyundaiShowroom ? 'text-white' : 'text-green-800'}`}>
                    {headerConfig.title}
                  </h1>
                  <p className={`${isHyundaiShowroom ? 'text-gray-200' : 'text-green-700'} text-sm`}>
                    {headerConfig.subtitle}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <FullscreenButton />
              <div className={`${
                sessionStatus === "CONNECTED" ? 
                  (isHyundaiShowroom ? "showroom-status-connected" : "restaurant-status-connected") :
                sessionStatus === "CONNECTING" ? 
                  (isHyundaiShowroom ? "showroom-status-connecting" : "restaurant-status-connecting") :
                  (isHyundaiShowroom ? "showroom-status-disconnected" : "restaurant-status-disconnected")
              }`}>
                {sessionStatus === "CONNECTED" && "🟢 Connected"}
                {sessionStatus === "CONNECTING" && "🟡 Connecting..."}
                {sessionStatus === "DISCONNECTED" && "🔴 Disconnected"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Security Context Warning Banner */}
      {!isSecureContext && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>⚠️ Limited functionality:</strong> Voice features require a secure connection. 
                  <span className="font-medium"> Use http://localhost:3002 for full voice functionality.</span>
                </p>
              </div>
            </div>
            <button 
              onClick={() => window.location.href = `http://localhost:3002${window.location.pathname}${window.location.search}`}
              className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              Switch to Localhost
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Dynamic Conversation Area */}
          <div className="lg:col-span-2">
            <div className={isHyundaiShowroom ? "showroom-card" : "restaurant-card"}>
              {/* Header with gradient and buttons */}
              <div className={`flex items-center justify-between px-6 py-4 sticky top-0 z-10 rounded-t-lg ${
                isHyundaiShowroom 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                  : 'bg-gradient-to-r from-yellow-400 to-yellow-500'
              }`}>
                <span className={`font-bold text-lg ${
                  isHyundaiShowroom ? 'text-white' : 'text-green-800'
                }`}>
                  {isHyundaiShowroom ? 'Showroom Consultation' : 'Order Conversation'}
                </span>
                <div className="flex gap-x-2">
                  <button className={`${
                    isHyundaiShowroom ? 'showroom-button-secondary' : 'restaurant-button-secondary'
                  } text-sm px-4 py-2 flex items-center justify-center gap-x-2 min-h-[44px] touch-friendly-btn`}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 2V1H10V2H5ZM4.75 0C4.33579 0 4 0.335786 4 0.75V1H3.5C2.67157 1 2 1.67157 2 2.5V12.5C2 13.3284 2.67157 14 3.5 14H7V13H3.5C3.22386 13 3 12.7761 3 12.5V2.5C3 2.22386 3.22386 2 3.5 2H4V2.25C4 2.66421 4.33579 3 4.75 3H10.25C10.6642 3 11 2.66421 11 2.25V2H11.5C11.7761 2 12 2.22386 12 2.5V7H13V2.5C13 1.67157 12.3284 1 11.5 1H11V0.75C11 0.335786 10.6642 0 10.25 0H4.75ZM9 8.5C9 8.77614 8.77614 9 8.5 9C8.22386 9 8 8.77614 8 8.5C8 8.22386 8.22386 8 8.5 8C8.77614 8 9 8.22386 9 8.5ZM10.5 9C10.7761 9 11 8.77614 11 8.5C11 8.22386 10.7761 8 10.5 8C10.2239 8 10 8.22386 10 8.5C10 8.77614 10.2239 9 10.5 9ZM13 8.5C13 8.77614 12.7761 9 12.5 9C12.2239 9 12 8.77614 12 8.5C12 8.22386 12.2239 8 12.5 8C12.7761 8 13 8.22386 13 8.5ZM14.5 9C14.7761 9 15 8.77614 15 8.5C15 8.22386 14.7761 8 14.5 8C14.2239 8 14 8.22386 14 8.5C14 8.77614 14.2239 9 14.5 9ZM15 10.5C15 10.7761 14.7761 11 14.5 11C14.2239 11 14 10.7761 14 10.5C14 10.2239 14.2239 10 14.5 10C14.7761 10 15 10.2239 15 10.5ZM14.5 13C14.7761 13 15 12.7761 15 12.5C15 12.2239 14.7761 12 14.5 12C14.2239 12 14 12.2239 14 12.5C14 12.7761 14.2239 13 14.5 13ZM14.5 15C14.7761 15 15 14.7761 15 14.5C15 14.2239 14.7761 14 14.5 14C14.2239 14 14 14.2239 14 14.5C14 14.7761 14.2239 15 14.5 15ZM8.5 11C8.77614 11 9 10.7761 9 10.5C9 10.2239 8.77614 10 8.5 10C8.22386 10 8 10.2239 8 10.5C8 10.7761 8.22386 11 8.5 11ZM9 12.5C9 12.7761 8.77614 13 8.5 13C8.22386 13 8 12.7761 8 12.5C8 12.2239 8.22386 12 8.5 12C8.77614 12 9 12.2239 9 12.5ZM8.5 15C8.77614 15 9 14.7761 9 14.5C9 14.2239 8.77614 14 8.5 14C8.22386 14 8 14.2239 8 14.5C8 14.7761 8.22386 15 8.5 15ZM11 14.5C11 14.7761 10.7761 15 10.5 15C10.2239 15 10 14.7761 10 14.5C10 14.2239 10.2239 14 10.5 14C10.7761 14 11 14.2239 11 14.5ZM12.5 15C12.7761 15 13 14.7761 13 14.5C13 14.2239 12.7761 14 12.5 14C12.2239 14 12 14.2239 12 14.5C12 14.7761 12.2239 15 12.5 15Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                    </svg>
                    Copy
                  </button>
                  <button 
                    onClick={downloadRecording}
                    className={`${
                      isHyundaiShowroom ? 'showroom-button-secondary' : 'restaurant-button-secondary'
                    } text-sm px-4 py-2 flex items-center justify-center gap-x-2 min-h-[44px] touch-friendly-btn`}
                  >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.50005 1.04999C7.74858 1.04999 7.95005 1.25146 7.95005 1.49999V8.41359L10.1819 6.18179C10.3576 6.00605 10.6425 6.00605 10.8182 6.18179C10.994 6.35753 10.994 6.64245 10.8182 6.81819L7.81825 9.81819C7.64251 9.99392 7.35759 9.99392 7.18185 9.81819L4.18185 6.81819C4.00611 6.64245 4.00611 6.35753 4.18185 6.18179C4.35759 6.00605 4.64251 6.00605 4.81825 6.18179L7.05005 8.41359V1.49999C7.05005 1.25146 7.25152 1.04999 7.50005 1.04999ZM2.5 10C2.77614 10 3 10.2239 3 10.5V12C3 12.5539 3.44565 13 3.99635 13H11.0012C11.5529 13 12 12.5528 12 12V10.5C12 10.2239 12.2239 10 12.5 10C12.7761 10 13 10.2239 13 10.5V12C13 13.1041 12.1062 14 11.0012 14H3.99635C2.89019 14 2 13.103 2 12V10.5C2 10.2239 2.22386 10 2.5 10Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                    </svg>
                    <span>Audio</span>
                  </button>
                  {sessionStatus === "CONNECTED" && (
                    <div className="flex items-center">
                      <span className={`pulse-animation text-white text-sm`}>
                        🎤 Listening...
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Transcript Component */}
              <div className={`${isHyundaiShowroom ? 'showroom-transcript' : 'restaurant-transcript'} min-h-[400px] max-h-[600px] overflow-y-auto p-6`}>
                <Transcript
                  userText={userText}
                  setUserText={setUserText}
                  onSendMessage={handleSendTextMessage}
                  downloadRecording={downloadRecording}
                  canSend={sessionStatus === "CONNECTED"}
                  agentType={isHyundaiShowroom ? 'showroom' : 'restaurant'}
                />
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            
            {/* Connection Control */}
            <div className={isHyundaiShowroom ? "showroom-card p-6" : "restaurant-card p-6"}>
              <h3 className={`text-xl font-bold ${isHyundaiShowroom ? 'text-blue-800' : 'text-green-800'} mb-4`}>
                {isHyundaiShowroom ? 'PAVS Assistant' : 'Voice Assistant'}
              </h3>
              <div className="space-y-4">
                <button
                  onClick={onToggleConnection}
                  className={`w-full ${
                    sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING"
                      ? (isHyundaiShowroom ? "showroom-button-secondary" : "restaurant-button-secondary")
                      : (isHyundaiShowroom ? "showroom-button" : "restaurant-button")
                  }`}
                  disabled={sessionStatus === "CONNECTING"}
                >
                  {sessionStatus === "CONNECTED" && "Disconnect Assistant"}
                  {sessionStatus === "CONNECTING" && "Connecting..."}
                  {sessionStatus === "DISCONNECTED" && (isHyundaiShowroom ? "🚗 Start Car Consultation" : "🎤 Start Voice Order")}
                </button>
                
                {!isSecureContext && sessionStatus === "DISCONNECTED" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-amber-800 text-sm">
                      <strong>💡 Note:</strong> Voice features work best on <code className="bg-amber-100 px-1 rounded">localhost:3002</code>
                    </p>
                  </div>
                )}
                
                {sessionStatus === "CONNECTED" && (
                  <div className={`text-center p-4 rounded-lg border-2 ${
                    isHyundaiShowroom 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <p className={`${isHyundaiShowroom ? 'text-blue-800' : 'text-green-800'} font-medium`}>
                      {isHyundaiShowroom ? 'Ready to help you find your perfect car!' : 'Ready to take your order!'}
                    </p>
                    <p className={`${isHyundaiShowroom ? 'text-blue-600' : 'text-green-600'} text-sm mt-1`}>
                      {isHyundaiShowroom 
                        ? 'Ask about our Hyundai models, or say "Hello"' 
                        : 'Say "Namaste" or start with your order'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Push to Talk Mode */}
            <div className={isHyundaiShowroom ? "showroom-card p-6" : "restaurant-card p-6"}>
              <h3 className={`text-lg font-bold ${isHyundaiShowroom ? 'text-blue-800' : 'text-green-800'} mb-3`}>Talk Mode</h3>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="ptt-toggle"
                  checked={isPTTActive}
                  onChange={(e) => setIsPTTActive(e.target.checked)}
                  className={`w-5 h-5 border-2 border-gray-300 rounded focus:ring-${isHyundaiShowroom ? 'blue' : 'yellow'}-500 ${isHyundaiShowroom ? 'text-blue-600' : 'text-yellow-600'}`}
                />
                <label htmlFor="ptt-toggle" className="text-gray-700 font-medium">
                  Push-to-Talk Mode
                </label>
              </div>
              
              {isPTTActive && sessionStatus === "CONNECTED" && (
                <div className="mt-4">
                  <button
                    onMouseDown={handleTalkButtonDown}
                    onMouseUp={handleTalkButtonUp}
                    onTouchStart={handleTalkButtonDown}
                    onTouchEnd={handleTalkButtonUp}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 ${
                      isPTTUserSpeaking
                        ? "bg-red-500 text-white shadow-lg transform scale-105"
                        : (isHyundaiShowroom ? "showroom-button" : "restaurant-button")
                    }`}
                  >
                    {isPTTUserSpeaking ? "🔴 Recording..." : "🎤 Hold to Talk"}
                  </button>
                </div>
              )}
            </div>

            {/* Robot Navigation Status (for Hyundai Showroom) */}
            {isHyundaiShowroom && (
              <>
                <RobotNavigationStatus />
                <RobotAPITester />
              </>
            )}

            {/* Audio Controls */}
            <div className={isHyundaiShowroom ? "showroom-card p-6" : "restaurant-card p-6"}>
              <h3 className={`text-lg font-bold ${isHyundaiShowroom ? 'text-blue-800' : 'text-green-800'} mb-3`}>Audio Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="audio-playback"
                    checked={isAudioPlaybackEnabled}
                    onChange={(e) => setIsAudioPlaybackEnabled(e.target.checked)}
                    className={`w-5 h-5 border-2 border-gray-300 rounded focus:ring-${isHyundaiShowroom ? 'blue' : 'yellow'}-500 ${isHyundaiShowroom ? 'text-blue-600' : 'text-yellow-600'}`}
                  />
                  <label htmlFor="audio-playback" className="text-gray-700 font-medium">
                    Audio Playback
                  </label>
                </div>
                
                <button
                  onClick={downloadRecording}
                  className={isHyundaiShowroom ? "showroom-button-secondary w-full" : "restaurant-button-secondary w-full"}
                  disabled={sessionStatus !== "CONNECTED"}
                >
                  📥 Download Recording
                </button>
              </div>
            </div>

            {/* Debug Panel (Optional) */}
            <div className={isHyundaiShowroom ? "showroom-card p-6" : "restaurant-card p-6"}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-lg font-bold ${isHyundaiShowroom ? 'text-blue-800' : 'text-green-800'}`}>Debug Info</h3>
                <button
                  onClick={() => setIsEventsPaneExpanded(!isEventsPaneExpanded)}
                  className={`${isHyundaiShowroom ? 'text-blue-600 hover:text-blue-700' : 'text-yellow-600 hover:text-yellow-700'} font-medium`}
                >
                  {isEventsPaneExpanded ? "Hide" : "Show"}
                </button>
              </div>
              
              {isEventsPaneExpanded && (
                <div className="max-h-48 overflow-y-auto">
                  <Events isExpanded={true} />
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
