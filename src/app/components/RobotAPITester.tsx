import { useState } from 'react';

export function RobotAPITester() {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Test basic connectivity first
  const testConnectivity = async () => {
    setIsLoading(true);
    try {
      console.log('Testing basic connectivity to robot server...');
      
      // Try to reach the base URL first
      const response = await fetch('http://192.168.77.200:8000/', {
        method: 'GET',
        mode: 'no-cors'
      });
      
      console.log('Base URL response:', response);
      setTestResult(`✅ CONNECTIVITY: Server reachable (status: ${response.status}, type: ${response.type})`);
    } catch (error) {
      console.error('Connectivity test failed:', error);
      setTestResult(`❌ CONNECTIVITY ERROR: ${error instanceof Error ? error.message : 'Server unreachable'}\n\nPossible causes:\n1. Robot server is down\n2. Network issue\n3. IP address changed\n4. Firewall blocking`);
    } finally {
      setIsLoading(false);
    }
  };

  const testStuckAPI = async () => {
    setIsLoading(true);
    try {
      console.log('Testing stuck API...');
      
      const response = await fetch('http://192.168.77.200:8000/api/v1/robot/stuck', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      setTestResult(`✅ SUCCESS: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testNavStatusAPI = async () => {
    setIsLoading(true);
    try {
      console.log('Testing nav-status API...');
      console.log('Making fetch request to:', 'http://192.168.77.200:8000/api/v1/robot/nav-status');
      
      // First try with minimal fetch options
      const response = await fetch('http://192.168.77.200:8000/api/v1/robot/nav-status', {
        method: 'GET',
        mode: 'no-cors'  // Try no-cors first to bypass CORS issues for testing
      });
      
      console.log('Response received:', response);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      setTestResult(`✅ SUCCESS: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testWaypointsAPI = async () => {
    setIsLoading(true);
    try {
      console.log('Testing waypoints API...');
      
      const response = await fetch('http://192.168.77.200:8000/api/v1/robot/waypoints', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      setTestResult(`✅ SUCCESS: ${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Robot API Tester</h3>
      
      <div className="space-y-3">
        <button
          onClick={testStuckAPI}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Testing...' : 'Test Stuck API'}
        </button>
        
        <button
          onClick={testNavStatusAPI}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isLoading ? 'Testing...' : 'Test Nav Status API'}
        </button>
        
        <button
          onClick={testWaypointsAPI}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {isLoading ? 'Testing...' : 'Test Waypoints API'}
        </button>
      </div>

      {testResult && (
        <div className="mt-4 p-3 bg-gray-50 border rounded">
          <h4 className="font-medium text-gray-800 mb-2">Test Result:</h4>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words">
            {testResult}
          </pre>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Robot URL:</strong> http://192.168.77.200:8000</p>
        <p><strong>Check browser console</strong> for detailed logs</p>
      </div>
    </div>
  );
}
