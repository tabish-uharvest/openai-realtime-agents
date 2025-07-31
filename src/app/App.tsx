"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";

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

// Map used by connect logic for scenarios defined via the SDK.
const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  restaurantOrder: restaurantOrderScenario,
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

        const companyName = restaurantOrderCompanyName;
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
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
      }
      return;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Restaurant Header */}
      <header className="restaurant-header">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 bg-green-800 rounded-full flex items-center justify-center">
                  <span className="text-yellow-400 font-bold text-lg">🍽️</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-green-800">UrbanHarvest Zaika</h1>
                  <p className="text-green-700 text-sm">Voice Ordering System</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`${
                sessionStatus === "CONNECTED" ? "restaurant-status-connected" :
                sessionStatus === "CONNECTING" ? "restaurant-status-connecting" :
                "restaurant-status-disconnected"
              }`}>
                {sessionStatus === "CONNECTED" && "🟢 Connected"}
                {sessionStatus === "CONNECTING" && "🟡 Connecting..."}
                {sessionStatus === "DISCONNECTED" && "🔴 Disconnected"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Order Conversation Area */}
          <div className="lg:col-span-2">
            <div className="restaurant-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-green-800">Your Order Conversation</h2>
                <div className="flex items-center space-x-2">
                  {sessionStatus === "CONNECTED" && (
                    <span className="pulse-animation text-green-600">🎤 Listening...</span>
                  )}
                </div>
              </div>
              
              {/* Transcript Component */}
              <div className="restaurant-transcript min-h-[400px] max-h-[600px] overflow-y-auto">
                <Transcript
                  userText={userText}
                  setUserText={setUserText}
                  onSendMessage={handleSendTextMessage}
                  downloadRecording={downloadRecording}
                  canSend={sessionStatus === "CONNECTED"}
                />
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            
            {/* Connection Control */}
            <div className="restaurant-card p-6">
              <h3 className="text-xl font-bold text-green-800 mb-4">Voice Assistant</h3>
              <div className="space-y-4">
                <button
                  onClick={onToggleConnection}
                  className={`w-full ${
                    sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING"
                      ? "restaurant-button-secondary"
                      : "restaurant-button"
                  }`}
                  disabled={sessionStatus === "CONNECTING"}
                >
                  {sessionStatus === "CONNECTED" && "Disconnect Assistant"}
                  {sessionStatus === "CONNECTING" && "Connecting..."}
                  {sessionStatus === "DISCONNECTED" && "🎤 Start Voice Order"}
                </button>
                
                {sessionStatus === "CONNECTED" && (
                  <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
                    <p className="text-green-800 font-medium">Ready to take your order!</p>
                    <p className="text-green-600 text-sm mt-1">
                      Say "Namaste" or start with your order
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Push to Talk Mode */}
            <div className="restaurant-card p-6">
              <h3 className="text-lg font-bold text-green-800 mb-3">Talk Mode</h3>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="ptt-toggle"
                  checked={isPTTActive}
                  onChange={(e) => setIsPTTActive(e.target.checked)}
                  className="w-5 h-5 text-yellow-600 border-2 border-gray-300 rounded focus:ring-yellow-500"
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
                        : "restaurant-button"
                    }`}
                  >
                    {isPTTUserSpeaking ? "🔴 Recording..." : "🎤 Hold to Talk"}
                  </button>
                </div>
              )}
            </div>

            {/* Audio Controls */}
            <div className="restaurant-card p-6">
              <h3 className="text-lg font-bold text-green-800 mb-3">Audio Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="audio-playback"
                    checked={isAudioPlaybackEnabled}
                    onChange={(e) => setIsAudioPlaybackEnabled(e.target.checked)}
                    className="w-5 h-5 text-yellow-600 border-2 border-gray-300 rounded focus:ring-yellow-500"
                  />
                  <label htmlFor="audio-playback" className="text-gray-700 font-medium">
                    Audio Playback
                  </label>
                </div>
                
                <button
                  onClick={downloadRecording}
                  className="restaurant-button-secondary w-full"
                  disabled={sessionStatus !== "CONNECTED"}
                >
                  📥 Download Recording
                </button>
              </div>
            </div>

            {/* Debug Panel (Optional) */}
            <div className="restaurant-card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-green-800">Debug Info</h3>
                <button
                  onClick={() => setIsEventsPaneExpanded(!isEventsPaneExpanded)}
                  className="text-yellow-600 hover:text-yellow-700 font-medium"
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
