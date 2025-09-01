import { useEffect, useState } from 'react';

interface RobotNavStatus {
  res: number;
  reason: number;
  goal: string;
  dist: number;
  mileage: number;
}

interface RobotStuckStatus {
  shouldplay: boolean;
}

const ROBOT_BASE_URL = 'http://192.168.77.200:8000';

const WAYPOINT_TO_CAR = {
  '1': 'Hyundai Creta',
  '2': 'Hyundai Verna',
  '3': 'Hyundai i20'
};

export function RobotNavigationStatus() {
  const [navStatus, setNavStatus] = useState<RobotNavStatus | null>(null);
  const [stuckStatus, setStuckStatus] = useState<RobotStuckStatus | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  // Fetch navigation status
  const fetchNavStatus = async () => {
    try {
      console.log('Attempting to fetch nav status from:', `${ROBOT_BASE_URL}/api/v1/robot/nav-status`);
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
      console.log('Nav status response:', data);
      setNavStatus(data);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to fetch nav status:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        url: `${ROBOT_BASE_URL}/api/v1/robot/nav-status`
      });
      setIsConnected(false);
    }
  };

  // Fetch stuck status
  const fetchStuckStatus = async () => {
    try {
      console.log('Attempting to fetch stuck status from:', `${ROBOT_BASE_URL}/api/v1/robot/stuck`);
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
      console.log('Stuck status response:', data);
      setStuckStatus(data);
    } catch (error) {
      console.error('Failed to fetch stuck status:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        url: `${ROBOT_BASE_URL}/api/v1/robot/stuck`
      });
    }
  };

  // Polling for status updates
  useEffect(() => {
    const navInterval = setInterval(fetchNavStatus, 2000); // Every 2 seconds
    const stuckInterval = setInterval(fetchStuckStatus, 3000); // Every 3 seconds
    
    // Initial fetch
    fetchNavStatus();
    fetchStuckStatus();

    return () => {
      clearInterval(navInterval);
      clearInterval(stuckInterval);
    };
  }, []);

  const getStatusDisplay = () => {
    if (!isConnected) {
      return { text: 'Robot Offline', color: 'text-red-600', dot: 'bg-red-400' };
    }
    
    if (stuckStatus?.shouldplay) {
      return { text: 'Robot Stuck - Help Needed', color: 'text-red-600', dot: 'bg-red-400 animate-pulse' };
    }

    if (!navStatus) {
      return { text: 'Connecting...', color: 'text-gray-500', dot: 'bg-gray-400' };
    }

    switch (navStatus.res) {
      case 1: // Navigation in progress
        const targetCar = WAYPOINT_TO_CAR[navStatus.goal as keyof typeof WAYPOINT_TO_CAR] || navStatus.goal;
        return { 
          text: `Moving to ${targetCar}`, 
          color: 'text-blue-600', 
          dot: 'bg-blue-400 animate-pulse',
          distance: navStatus.dist
        };
      case 3: // Navigation completed
        if (navStatus.reason === 0) {
          const arrivedCar = WAYPOINT_TO_CAR[navStatus.goal as keyof typeof WAYPOINT_TO_CAR] || navStatus.goal;
          return { text: `At ${arrivedCar}`, color: 'text-green-600', dot: 'bg-green-400' };
        }
        return { text: 'Navigation Error', color: 'text-red-600', dot: 'bg-red-400' };
      case 6: // Not navigating
        return { text: 'Robot Ready', color: 'text-gray-600', dot: 'bg-gray-400' };
      default:
        return { text: 'Unknown Status', color: 'text-yellow-600', dot: 'bg-yellow-400' };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Robot Status</h3>
      
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 rounded-full ${status.dot}`}></div>
        <div className="flex-1">
          <div className={`font-medium ${status.color}`}>
            {status.text}
          </div>
          {status.distance !== undefined && (
            <div className="text-sm text-gray-600">
              Distance remaining: {status.distance.toFixed(1)}m
            </div>
          )}
        </div>
      </div>

      {stuckStatus?.shouldplay && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center text-red-800 text-sm">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Robot needs assistance - please clear path
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-gray-600 text-sm">
            Cannot connect to robot at {ROBOT_BASE_URL}
          </div>
        </div>
      )}
    </div>
  );
}
