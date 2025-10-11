/**
 * Real-Time Booking Demo Page
 * Demonstrates the live availability system
 */

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import RealTimeBooking from '../../components/RealTimeBooking';
import { Calendar, Clock, Zap, Users, Settings, RefreshCw } from 'lucide-react';

export default function RealTimeBookingDemo() {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedService, setSelectedService] = useState<number | undefined>(1);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [availabilityData, setAvailabilityData] = useState<any>(null);

  useEffect(() => {
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  const services = [
    { id: 1, name: 'Basic Wash', duration: 30, price: 25 },
    { id: 2, name: 'Premium Wash', duration: 60, price: 45 },
    { id: 3, name: 'Full Detail', duration: 120, price: 85 },
  ];

  const handleTimeSlotSelect = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot);
    console.log('Selected time slot:', timeSlot);
  };

  const handleAvailabilityChange = (data: any) => {
    setAvailabilityData(data);
    console.log('Availability updated:', data);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    setSelectedTimeSlot(null); // Reset selected time slot
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const serviceId = e.target.value ? parseInt(e.target.value) : undefined;
    setSelectedService(serviceId);
    setSelectedTimeSlot(null); // Reset selected time slot
  };

  return (
    <>
      <Head>
        <title>Real-Time Booking Demo - Premium Auto Pesu</title>
        <meta name="description" content="Experience our real-time booking system with live availability updates" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center space-x-3">
              <Zap className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Real-Time Booking System Demo
                </h1>
                <p className="text-gray-600">
                  Experience live availability updates and conflict detection
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Booking Controls */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
                <div className="flex items-center space-x-2">
                  <Settings className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Booking Configuration
                  </h2>
                </div>

                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={handleDateChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Service Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Service
                  </label>
                  <select
                    value={selectedService || ''}
                    onChange={handleServiceChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Services</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} ({service.duration}min - €{service.price})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Information */}
                {selectedTimeSlot && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-2">Selected Booking</h3>
                    <div className="space-y-1 text-sm text-blue-700">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(selectedDate).toLocaleDateString()}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        {selectedTimeSlot}
                      </div>
                      {selectedService && (
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          {services.find(s => s.id === selectedService)?.name}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Availability Summary */}
                {availabilityData && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Availability Summary</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Total Slots</div>
                        <div className="font-semibold">{availabilityData.summary?.totalSlots || 0}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Available</div>
                        <div className="font-semibold text-green-600">
                          {availabilityData.summary?.availableSlots || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Features List */}
              <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Real-Time Features</h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-center">
                    <Zap className="h-4 w-4 text-green-500 mr-2" />
                    Live availability updates
                  </li>
                  <li className="flex items-center">
                    <RefreshCw className="h-4 w-4 text-blue-500 mr-2" />
                    Automatic conflict detection
                  </li>
                  <li className="flex items-center">
                    <Clock className="h-4 w-4 text-purple-500 mr-2" />
                    5-minute booking holds
                  </li>
                  <li className="flex items-center">
                    <Users className="h-4 w-4 text-orange-500 mr-2" />
                    Multi-user synchronization
                  </li>
                </ul>
              </div>
            </div>

            {/* Real-Time Booking Component */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                {selectedDate ? (
                  <RealTimeBooking
                    selectedDate={selectedDate}
                    serviceId={selectedService}
                    onTimeSlotSelect={handleTimeSlotSelect}
                    onAvailabilityChange={handleAvailabilityChange}
                  />
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Please select a date to view availability</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Demo Instructions */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-3">Demo Instructions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
              <div>
                <h4 className="font-medium mb-2">How to Test:</h4>
                <ul className="space-y-1">
                  <li>• Select a date and service</li>
                  <li>• Click on available time slots</li>
                  <li>• Watch for real-time updates</li>
                  <li>• Open multiple tabs to see synchronization</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Features Demonstrated:</h4>
                <ul className="space-y-1">
                  <li>• WebSocket-based real-time updates</li>
                  <li>• Redis caching for performance</li>
                  <li>• Booking conflict detection</li>
                  <li>• Temporary booking holds</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}