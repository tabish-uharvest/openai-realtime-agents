import { restaurantOrderAgent } from './orderAgent';
import type { RealtimeAgent } from '@openai/agents/realtime';

export const restaurantOrderScenario: RealtimeAgent[] = [restaurantOrderAgent];

// Name of the restaurant represented by this agent set. Used by guardrails
export const restaurantOrderCompanyName = 'UrbanHarvest Zaika';
