import { restaurantOrderScenario } from './restaurantOrder';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  restaurantOrder: restaurantOrderScenario,
};

export const defaultAgentSetKey = 'restaurantOrder';
