import { restaurantOrderScenario } from './restaurantOrder';
import { hyundaiShowroomScenario } from './hyundaiShowroom';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  restaurantOrder: restaurantOrderScenario,
  hyundaiShowroom: hyundaiShowroomScenario,
};

export const defaultAgentSetKey = 'hyundaiShowroom';
