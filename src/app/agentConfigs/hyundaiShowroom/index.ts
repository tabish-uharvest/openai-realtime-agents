import { hyundaiShowroomAgent } from './showroomAgent';
import type { RealtimeAgent } from '@openai/agents/realtime';

export const hyundaiShowroomScenario: RealtimeAgent[] = [hyundaiShowroomAgent];

// Name of the showroom represented by this agent set
export const hyundaiShowroomCompanyName = 'Hyundai Capital Showroom';
