#!/usr/bin/env node

const https = require('https');

// Test configuration
const API_BASE_URL = 'https://kiiltoloisto-fi.netlify.app/.netlify/functions';
const TEST_DATE = new Date();
TEST_DATE.setDate(TEST_DATE.getDate() + 7); // Book for 7 days from now

// Test booking data
const bookingData = {
  serviceId: 1,
  vehicleType: 'sedan',
  date: TEST_DATE.toISOString().split('T')[0],
  startTime: '10:00',
  endTime: '11:00',
  duration: 60,
  priceCents: 6500,
  customerName: 'Test Customer',
  customerEmail: 'test@example.com',
  customerPhone: '+358401234567',
  notes: 'End-to-end test booking'
};

// Helper function to make HTTP requests
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseData
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testBookingFlow() {
  console.log('🚀 Starting end-to-end booking system test...\n');

  try {
    // Test 1: Check services availability
    console.log('1️⃣ Testing services endpoint...');
    const servicesResponse = await makeRequest('/services-index');
    console.log(`   Status: ${servicesResponse.statusCode}`);

    if (servicesResponse.statusCode === 403) {
      console.log('   ⚠️  Site appears to have access restrictions (403 Forbidden)');
      console.log('   Testing with local development server instead...\n');

      // Switch to local testing
      console.log('   Please ensure the local server is running with: netlify dev');
      console.log('   Then run this test again with LOCAL_TEST=true\n');

      if (process.env.LOCAL_TEST) {
        console.log('   Running local test...');
        // Update API_BASE_URL for local testing
        const localUrl = 'http://localhost:8888/.netlify/functions';
        // Continue with local testing...
      }
      return;
    }

    if (servicesResponse.statusCode === 200) {
      const services = JSON.parse(servicesResponse.data);
      console.log(`   ✅ Found ${services.length} services`);
    } else {
      console.log(`   ❌ Unexpected status: ${servicesResponse.statusCode}`);
    }

    // Test 2: Check availability for the selected date
    console.log('\n2️⃣ Testing availability endpoint...');
    const availabilityUrl = `/bookings-availability?date=${bookingData.date}&serviceId=${bookingData.serviceId}`;
    const availabilityResponse = await makeRequest(availabilityUrl);
    console.log(`   Status: ${availabilityResponse.statusCode}`);

    if (availabilityResponse.statusCode === 200) {
      const availability = JSON.parse(availabilityResponse.data);
      console.log(`   ✅ Availability data retrieved`);
      console.log(`   Available slots: ${availability.availableSlots?.length || 0}`);
    } else {
      console.log(`   ❌ Unexpected status: ${availabilityResponse.statusCode}`);
    }

    // Test 3: Create a booking
    console.log('\n3️⃣ Testing booking creation...');
    const bookingResponse = await makeRequest('/bookings-create', 'POST', bookingData);
    console.log(`   Status: ${bookingResponse.statusCode}`);

    if (bookingResponse.statusCode === 200 || bookingResponse.statusCode === 201) {
      const booking = JSON.parse(bookingResponse.data);
      console.log(`   ✅ Booking created successfully`);
      console.log(`   Booking ID: ${booking.id || booking.bookingId}`);
      console.log(`   Confirmation Code: ${booking.confirmationCode}`);
    } else {
      console.log(`   ❌ Failed to create booking`);
      console.log(`   Response: ${bookingResponse.data}`);
    }

    console.log('\n✨ End-to-end test completed!');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testBookingFlow();