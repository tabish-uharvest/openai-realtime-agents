import { useState, useEffect, useCallback, useRef } from 'react';

// Robot API types
export interface RobotWaypoint {
  name: string;
  type: 'delivery' | 'production' | 'charging' | 'recycling';
  pose: {
    x: number;
    y: number;
    theta: number;
  };
}

export interface RobotNavStatus {
  res: number;        // 1=navigating, 3=completed, 6=idle
  reason: number;     // 0=success, 4=target not found
  goal: string;       // Current target waypoint
  dist: number;       // Remaining distance in meters
  mileage: number;    // Distance traveled in meters
}

export interface RobotStuckStatus {
  shouldplay: boolean; // true=stuck, false=normal
}

// Robot API configuration
const ROBOT_BASE_URL = 'http://192.168.77.200:8000';

// Car location mapping
export const CAR_WAYPOINTS = {
  'creta': '1',
  'verna': '2', 
  'i20': '3'
} as const;

export const WAYPOINT_TO_CAR = {
  '1': 'Hyundai Creta',
  '2': 'Hyundai Verna',
  '3': 'Hyundai i20'
} as const;

// Custom hook for robot navigation
export function useRobotNavigation() {
  const [navStatus, setNavStatus] = useState<RobotNavStatus | null>(null);
  const [stuckStatus, setStuckStatus] = useState<RobotStuckStatus | null>(null);
  const [waypoints, setWaypoints] = useState<RobotWaypoint[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stuckPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch waypoints
  const fetchWaypoints = useCallback(async () => {
    try {
      console.log('Fetching robot waypoints...');
      const response = await fetch(`${ROBOT_BASE_URL}/api/v1/robot/waypoints`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Waypoints response:', data);
      setWaypoints(data.waypoints || []);
      return data.waypoints;
    } catch (error) {
      console.error('Failed to fetch waypoints:', error);
      return [];
    }
  }, []);

  // Navigate to waypoint
  const navigateToWaypoint = useCallback(async (waypointName: string) => {
    try {
      console.log(`Navigating to waypoint: ${waypointName}`);
      const response = await fetch(`${ROBOT_BASE_URL}/api/v1/robot/goto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({ point: waypointName }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Navigation response:', data);
      
      if (data.status === 'success') {
        setIsPolling(true); // Start status polling
        return { success: true };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Navigation request failed:', error);
      return { success: false, error: 'Network error' };
    }
  }, []);

  // Navigate to car by name
  const navigateToCar = useCallback(async (carName: keyof typeof CAR_WAYPOINTS) => {
    const waypoint = CAR_WAYPOINTS[carName];
    if (!waypoint) {
      return { success: false, error: 'Unknown car' };
    }
    return navigateToWaypoint(waypoint);
  }, [navigateToWaypoint]);

  // Fetch navigation status
  const fetchNavStatus = useCallback(async () => {
    try {
      const response = await fetch(`${ROBOT_BASE_URL}/api/v1/robot/nav-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setNavStatus(data);
      
      // Stop polling if navigation completed or idle
      if (data.res === 3 || data.res === 6) {
        setIsPolling(false);
      }
      
      return data;
    } catch (error) {
      console.error('Failed to fetch nav status:', error);
      return null;
    }
  }, []);

  // Fetch stuck status
  const fetchStuckStatus = useCallback(async () => {
    try {
      const response = await fetch(`${ROBOT_BASE_URL}/api/v1/robot/stuck`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStuckStatus(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch stuck status:', error);
      return null;
    }
  }, []);

  // Start navigation status polling
  useEffect(() => {
    if (isPolling) {
      pollingIntervalRef.current = setInterval(() => {
        fetchNavStatus();
      }, 1500); // Poll every 1.5 seconds during navigation
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isPolling, fetchNavStatus]);

  // Start stuck status polling (continuous)
  useEffect(() => {
    stuckPollingIntervalRef.current = setInterval(() => {
      fetchStuckStatus();
    }, 3000); // Poll every 3 seconds

    // Initial fetch
    fetchStuckStatus();

    return () => {
      if (stuckPollingIntervalRef.current) {
        clearInterval(stuckPollingIntervalRef.current);
      }
    };
  }, [fetchStuckStatus]);

  // Get navigation status display
  const getNavigationStatus = useCallback(() => {
    if (!navStatus) {
      return { text: 'Connecting...', status: 'connecting', isNavigating: false };
    }

    switch (navStatus.res) {
      case 1: // Navigation in progress
        return { 
          text: `Navigating to ${WAYPOINT_TO_CAR[navStatus.goal as keyof typeof WAYPOINT_TO_CAR] || navStatus.goal}`, 
          status: 'navigating', 
          isNavigating: true,
          distance: navStatus.dist,
          target: navStatus.goal
        };
      case 3: // Navigation completed
        if (navStatus.reason === 0) {
          return { 
            text: `Arrived at ${WAYPOINT_TO_CAR[navStatus.goal as keyof typeof WAYPOINT_TO_CAR] || navStatus.goal}`, 
            status: 'arrived', 
            isNavigating: false,
            mileage: navStatus.mileage
          };
        }
        return { text: 'Navigation Error', status: 'error', isNavigating: false };
      case 6: // Not navigating
        return { text: 'Ready', status: 'ready', isNavigating: false };
      default:
        return { text: 'Error', status: 'error', isNavigating: false };
    }
  }, [navStatus]);

  // Initialize waypoints on mount
  useEffect(() => {
    fetchWaypoints();
  }, [fetchWaypoints]);

  return {
    navStatus,
    stuckStatus,
    waypoints,
    isPolling,
    navigateToWaypoint,
    navigateToCar,
    fetchNavStatus,
    fetchStuckStatus,
    fetchWaypoints,
    getNavigationStatus,
    isStuck: stuckStatus?.shouldplay || false
  };
}
