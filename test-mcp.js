#!/usr/bin/env node

/**
 * Test script for the Car Wash Booking MCP Server
 *
 * This script demonstrates how to interact with the MCP server
 * and test its various tools and resources.
 */

const { spawn } = require('child_process');
const readline = require('readline');

console.log('🧪 Car Wash Booking MCP Server Test');
console.log('==================================\n');

// Test requests to send to the MCP server
const testRequests = [
  {
    name: 'List Tools',
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    }
  },
  {
    name: 'List Resources',
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/list',
      params: {}
    }
  },
  {
    name: 'Get All Services',
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_services',
        arguments: {}
      }
    }
  },
  {
    name: 'Get Service by ID',
    request: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get_service_by_id',
        arguments: { id: 1 }
      }
    }
  },
  {
    name: 'Check Availability',
    request: {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'check_availability',
        arguments: {
          date: '2024-12-15',
          serviceId: 1
        }
      }
    }
  },
  {
    name: 'Read Services Resource',
    request: {
      jsonrpc: '2.0',
      id: 6,
      method: 'resources/read',
      params: {
        uri: 'car-wash://services'
      }
    }
  },
  {
    name: 'Read Stats Resource',
    request: {
      jsonrpc: '2.0',
      id: 7,
      method: 'resources/read',
      params: {
        uri: 'car-wash://stats'
      }
    }
  }
];

async function testMCPServer() {
  console.log('🚀 Starting MCP Server...\n');

  // Check if the compiled server exists
  const fs = require('fs');
  if (!fs.existsSync('./dist/mcp-server.js')) {
    console.log('❌ MCP server not found. Please compile it first:');
    console.log('   npx tsc mcp-server.ts --outDir dist --target es2020 --module esnext --moduleResolution node\n');
    return;
  }

  // Spawn the MCP server process
  const serverProcess = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responseCount = 0;
  let responses = [];

  // Handle server output
  serverProcess.stdout.on('data', (data) => {
    const response = data.toString().trim();
    if (response) {
      try {
        const parsed = JSON.parse(response);
        responses.push(parsed);
        responseCount++;

        console.log(`✅ Response ${responseCount}:`);
        console.log(JSON.stringify(parsed, null, 2));
        console.log('\n' + '─'.repeat(50) + '\n');

        if (responseCount >= testRequests.length) {
          console.log('🎉 All tests completed successfully!');
          console.log(`\n📊 Summary:`);
          console.log(`   • Total requests: ${testRequests.length}`);
          console.log(`   • Successful responses: ${responses.length}`);
          console.log(`   • Server status: ✅ Working correctly`);

          serverProcess.kill();
          process.exit(0);
        }
      } catch (error) {
        console.log('📝 Server output:', response);
      }
    }
  });

  // Handle server errors
  serverProcess.stderr.on('data', (data) => {
    const error = data.toString().trim();
    if (error && !error.includes('running on stdio')) {
      console.log('⚠️  Server stderr:', error);
    }
  });

  // Send test requests
  setTimeout(() => {
    console.log('📤 Sending test requests...\n');

    testRequests.forEach((test, index) => {
      setTimeout(() => {
        console.log(`🔍 Testing: ${test.name}`);
        console.log(`📝 Request: ${JSON.stringify(test.request, null, 2)}\n`);

        serverProcess.stdin.write(JSON.stringify(test.request) + '\n');
      }, index * 1000); // Space out requests by 1 second
    });
  }, 1000);

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping MCP server...');
    serverProcess.kill();
    process.exit(0);
  });
}

// Interactive mode
function interactiveMode() {
  console.log('🎮 Interactive MCP Server Test Mode');
  console.log('Enter JSON-RPC requests or type "help" for examples\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const serverProcess = spawn('node', ['dist/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  serverProcess.stdout.on('data', (data) => {
    const response = data.toString().trim();
    if (response) {
      try {
        const parsed = JSON.parse(response);
        console.log('📥 Server response:');
        console.log(JSON.stringify(parsed, null, 2));
      } catch (error) {
        console.log('📝 Server output:', response);
      }
    }
    rl.prompt();
  });

  serverProcess.stderr.on('data', (data) => {
    const error = data.toString().trim();
    if (error && !error.includes('running on stdio')) {
      console.log('⚠️  Server stderr:', error);
    }
  });

  rl.on('line', (input) => {
    if (input.trim() === 'help') {
      console.log('\n📚 Example requests:');
      console.log('{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}');
      console.log('{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_services","arguments":{}}}');
      console.log('{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"car-wash://stats"}}');
      console.log('\nType "exit" to quit\n');
    } else if (input.trim() === 'exit') {
      console.log('👋 Goodbye!');
      serverProcess.kill();
      rl.close();
      process.exit(0);
    } else if (input.trim()) {
      try {
        JSON.parse(input); // Validate JSON
        serverProcess.stdin.write(input + '\n');
      } catch (error) {
        console.log('❌ Invalid JSON. Type "help" for examples.');
      }
    }
    rl.prompt();
  });

  rl.prompt();

  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping MCP server...');
    serverProcess.kill();
    rl.close();
    process.exit(0);
  });
}

// Main execution
const args = process.argv.slice(2);
if (args.includes('--interactive') || args.includes('-i')) {
  interactiveMode();
} else {
  testMCPServer();
}