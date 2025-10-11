// Test the real booking system
// Run this script with: node test-real-booking.js

const API_URL = 'http://localhost:3002/api/bookings/create';
const NETLIFY_API_URL = 'http://localhost:8888/.netlify/functions/bookings-create';

async function testBooking(url, name) {
  const bookingData = {
    serviceId: 1,
    vehicleType: 'sedan',
    date: '2025-10-15',
    startTime: '14:00',
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    customerPhone: '+358401234567',
    licensePlate: 'TEST-123',
    notes: 'Automated test booking'
  };

  console.log(`\n${name}:`);
  console.log('Testing URL:', url);
  console.log('Sending data:', JSON.stringify(bookingData, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ SUCCESS!');
      console.log('Confirmation Code:', result.booking.confirmationCode);
      console.log('Booking ID:', result.booking.id);
      console.log('\nYou can test the confirmation page at:');
      console.log(`http://localhost:3002/booking/confirmation?booking=${result.booking.confirmationCode}`);
    } else {
      console.log('❌ FAILED');
      console.log('Status:', response.status);
      console.log('Error:', result.error || 'Unknown error');
    }

    console.log('\nFull response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('❌ NETWORK ERROR');
    console.log('Error:', error.message);
    console.log('Make sure the server is running on the correct port');
  }
}

async function main() {
  console.log('===== TESTING BOOKING SYSTEM =====');

  // Test Next.js API route
  await testBooking(API_URL, 'TEST 1: Next.js API Route');

  // Test Netlify Function
  await testBooking(NETLIFY_API_URL, 'TEST 2: Netlify Function');
}

main().catch(console.error);