import { tool } from '@openai/agents/realtime';

// Robot navigation tools for Hyundai showroom agent
export const robotNavigationTools = [
  tool({
    name: 'navigate_to_car',
    description: 'Navigate the robot to a specific car location in the showroom. Ask user permission before navigating.',
    parameters: {
      type: 'object',
      properties: {
        car_name: {
          type: 'string',
          enum: ['creta', 'verna', 'i20'],
          description: 'The car to navigate to: creta (Hyundai Creta), verna (Hyundai Verna), or i20 (Hyundai i20)'
        },
        user_confirmed: {
          type: 'boolean',
          description: 'Whether the user has confirmed they want to go to this car location'
        }
      },
      required: ['car_name', 'user_confirmed'],
      additionalProperties: false
    },
    execute: async (input: any) => {
      const { car_name, user_confirmed } = input;
      
      if (!user_confirmed) {
        const carDisplayName = {
          'creta': 'Hyundai Creta',
          'verna': 'Hyundai Verna', 
          'i20': 'Hyundai i20'
        }[car_name as 'creta' | 'verna' | 'i20'];
        
        return {
          success: false,
          requires_confirmation: true,
          message: `Would you like me to take you to see the ${carDisplayName}? I can guide you there right now!`
        };
      }

      const carDisplayName = {
        'creta': 'Hyundai Creta',
        'verna': 'Hyundai Verna', 
        'i20': 'Hyundai i20'
      }[car_name];

      try {
        // Call robot API to navigate
        console.log(`Attempting to navigate to ${carDisplayName}, waypoint: ${car_name === 'creta' ? '1' : car_name === 'verna' ? '2' : '3'}`);
        const response = await fetch('http://192.168.77.200:8000/api/v1/robot/goto', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors',
          body: JSON.stringify({ 
            point: car_name === 'creta' ? '1' : car_name === 'verna' ? '2' : '3'
          }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Navigation response:', result);
        
        if (result.status === 'success') {
          return {
            success: true,
            message: `Excellent! I'm now taking you to see the ${carDisplayName}. Please follow me as we navigate through the showroom. This will be a great opportunity to see the car up close!`,
            car_name: carDisplayName,
            status: 'navigating',
            waypoint: car_name === 'creta' ? '1' : car_name === 'verna' ? '2' : '3'
          };
        } else {
          return {
            success: false,
            message: `I apologize, but I'm having trouble navigating to the ${carDisplayName} at the moment. ${result.message || 'Please ensure the robot system is connected and try again.'}`
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `I'm sorry, there's a technical issue with the navigation system. The robot may be offline. Please contact our technical support or try again in a few moments.`
        };
      }
    }
  }),
  
  tool({
    name: 'check_navigation_status',
    description: 'Check the current navigation status of the robot',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    },
    execute: async () => {
      try {
        console.log('Checking robot navigation status...');
        const response = await fetch('http://192.168.77.200:8000/api/v1/robot/nav-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const navStatus = await response.json();
        console.log('Nav status response:', navStatus);
        
        const waypointToCar = {
          '1': 'Hyundai Creta',
          '2': 'Hyundai Verna',
          '3': 'Hyundai i20'
        };
        
        const targetCar = waypointToCar[navStatus.goal as keyof typeof waypointToCar] || navStatus.goal;
        
        switch (navStatus.res) {
          case 1: // Navigation in progress
            if (navStatus.goal === 'product_point') {
              return {
                status: 'returning',
                message: `We are currently heading back to our welcome area. Distance remaining: ${navStatus.dist.toFixed(1)} meters. Almost there!`,
                distance_remaining: navStatus.dist,
                target: 'Welcome Area',
                mileage_traveled: navStatus.mileage
              };
            }
            return {
              status: 'navigating',
              message: `We are currently on our way to the ${targetCar}. Distance remaining: ${navStatus.dist.toFixed(1)} meters. We should arrive shortly!`,
              distance_remaining: navStatus.dist,
              target: targetCar,
              mileage_traveled: navStatus.mileage
            };
          case 3: // Navigation completed
            if (navStatus.reason === 0) {
              if (navStatus.goal === 'product_point') {
                return {
                  status: 'arrived_welcome',
                  message: `Wonderful! We have successfully returned to our welcome area. From here, you can explore our complete range of Hyundai vehicles. I'm ready to show you more cars or answer any questions you might have about our lineup!`,
                  target: 'Welcome Area',
                  total_distance: navStatus.mileage
                };
              }
              return {
                status: 'arrived',
                message: `Perfect! We have successfully arrived at the ${targetCar}. You can now see the car up close and explore all its amazing features. Take your time to examine the exterior, interior, and ask me any questions about its specifications!`,
                target: targetCar,
                total_distance: navStatus.mileage
              };
            }
            return {
              status: 'error',
              message: 'There was an issue completing the navigation. Let me help you resolve this.',
              reason: navStatus.reason
            };
          case 6: // Not navigating
            return {
              status: 'ready',
              message: 'I am ready and available to take you to any car you would like to see in our showroom. Just let me know which model interests you!'
            };
          default:
            return {
              status: 'unknown',
              message: 'The navigation system is in an unknown state. Let me check what\'s happening.',
              raw_status: navStatus.res
            };
        }
      } catch (error) {
        return {
          status: 'error',
          message: 'I cannot check the navigation status at the moment. The robot may be offline. Please ensure the robot is connected.'
        };
      }
    }
  }),
  
  tool({
    name: 'return_to_main_area',
    description: 'Navigate the robot back to the main showroom area after viewing a car',
    parameters: {
      type: 'object',
      properties: {
        user_confirmed: {
          type: 'boolean',
          description: 'Whether the user has confirmed they want to return to the main area'
        }
      },
      required: ['user_confirmed'],
      additionalProperties: false
    },
    execute: async (input: any) => {
      const { user_confirmed } = input;
      
      if (!user_confirmed) {
        return {
          success: false,
          requires_confirmation: true,
          message: 'Shall I take you back to the main showroom area where you can explore more options and learn about other Hyundai models?'
        };
      }

      try {
        console.log('Attempting to return to welcome area...');
        const response = await fetch('http://192.168.77.200:8000/api/v1/robot/goto', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors',
          body: JSON.stringify({ point: 'product_point' }), // Main area waypoint
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Return navigation response:', result);
        
        if (result.status === 'success') {
          return {
            success: true,
            message: 'Perfect! Now I\'m taking you back to our welcome area where you can explore more Hyundai models and options. Let\'s head back together!',
            status: 'returning'
          };
        } else {
          return {
            success: false,
            message: `I'm having trouble navigating back to the main area at the moment. ${result.message || 'Please try again or contact technical support.'}`
          };
        }
      } catch (error) {
        return {
          success: false,
          message: 'There was a technical issue with returning to the main area. The robot navigation system may be offline. Please contact technical support.'
        };
      }
    }
  }),
  
  tool({
    name: 'check_robot_stuck_status',
    description: 'Check if the robot is stuck and needs assistance',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    },
    execute: async () => {
      try {
        console.log('Checking robot stuck status...');
        const response = await fetch('http://192.168.77.200:8000/api/v1/robot/stuck', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const stuckStatus = await response.json();
        console.log('Stuck status response:', stuckStatus);
        
        if (stuckStatus.shouldplay) {
          return {
            stuck: true,
            message: 'I appear to be stuck and need some assistance. Could you please help clear the path or contact our technical support team? I want to make sure I can continue providing you with the best service possible.',
            requires_help: true
          };
        } else {
          return {
            stuck: false,
            message: 'All systems are functioning perfectly! I can navigate freely throughout the showroom and I\'m ready to take you to see any car that interests you.',
            status: 'operational'
          };
        }
      } catch (error) {
        return {
          stuck: false,
          message: 'I cannot check my operational status at the moment, but I believe I\'m functioning normally. If you notice any issues with my movement, please let me know.',
          status: 'unknown'
        };
      }
    }
  })
];

// Robot navigation tool implementations
export const createRobotNavigationToolImplementations = (robotHook: any) => {
  return {
    navigate_to_car: async (args: { car_name: 'creta' | 'verna' | 'i20', user_confirmed: boolean }) => {
      const { car_name, user_confirmed } = args;
      
      if (!user_confirmed) {
        return {
          success: false,
          message: 'User confirmation required before navigation. Ask the user: "Would you like me to take you to see the [car name]?"'
        };
      }

      const carDisplayName = {
        'creta': 'Hyundai Creta',
        'verna': 'Hyundai Verna', 
        'i20': 'Hyundai i20'
      }[car_name];

      try {
        const result = await robotHook.navigateToCar(car_name);
        
        if (result.success) {
          return {
            success: true,
            message: `Great! I'm now taking you to see the ${carDisplayName}. Please follow me as we navigate through the showroom.`,
            car_name: carDisplayName,
            status: 'navigating'
          };
        } else {
          return {
            success: false,
            message: `I'm sorry, I encountered an issue while trying to navigate to the ${carDisplayName}. ${result.error || 'Please try again.'}`
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `I'm sorry, there was a technical issue with the navigation system. Please ensure the robot is connected and try again.`
        };
      }
    },

    check_navigation_status: async () => {
      try {
        const status = robotHook.getNavigationStatus();
        
        return {
          ...status,
          message: (() => {
            switch (status.status) {
              case 'navigating':
                return `We are currently on our way to the ${status.target === '1' ? 'Hyundai Creta' : status.target === '2' ? 'Hyundai Verna' : status.target === '3' ? 'Hyundai i20' : 'destination'}. Distance remaining: ${status.distance?.toFixed(1)}m.`;
              case 'arrived':
                return `Perfect! We have arrived at the ${status.target === '1' ? 'Hyundai Creta' : status.target === '2' ? 'Hyundai Verna' : status.target === '3' ? 'Hyundai i20' : 'destination'}. You can now see the car up close and explore its features.`;
              case 'ready':
                return 'I am ready to take you to any car you would like to see in our showroom.';
              case 'error':
                return 'There seems to be a navigation issue. Let me help you resolve this.';
              default:
                return 'Checking navigation status...';
            }
          })()
        };
      } catch (error) {
        return {
          success: false,
          message: 'Unable to check navigation status at the moment. Please ensure the robot is connected.'
        };
      }
    },

    return_to_main_area: async (args: { user_confirmed: boolean }) => {
      const { user_confirmed } = args;
      
      if (!user_confirmed) {
        return {
          success: false,
          message: 'User confirmation required. Ask the user: "Shall I take you back to the main showroom area?"'
        };
      }

      try {
        // Navigate to a default waypoint (you might want to add a main area waypoint)
        // For now, we'll use product_point as the main area
        const result = await robotHook.navigateToWaypoint('product_point');
        
        if (result.success) {
          return {
            success: true,
            message: 'Excellent! I\'m now taking you back to the main showroom area where you can explore more options.',
            status: 'returning'
          };
        } else {
          return {
            success: false,
            message: `I'm having trouble navigating back to the main area. ${result.error || 'Please try again.'}`
          };
        }
      } catch (error) {
        return {
          success: false,
          message: 'There was an issue with returning to the main area. Please ensure the robot is connected and try again.'
        };
      }
    },

    check_robot_stuck_status: async () => {
      try {
        const stuckStatus = robotHook.stuckStatus;
        const isStuck = robotHook.isStuck;
        
        if (isStuck) {
          return {
            stuck: true,
            message: 'I appear to be stuck and need some assistance. Could you please help clear the path or contact technical support?'
          };
        } else {
          return {
            stuck: false,
            message: 'All systems are functioning normally. I can navigate freely throughout the showroom.'
          };
        }
      } catch (error) {
        return {
          stuck: false,
          message: 'Unable to check robot status at the moment.'
        };
      }
    }
  };
};
