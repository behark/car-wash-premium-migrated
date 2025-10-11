import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RealTimeBooking from '../RealTimeBooking';
import { io } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

const mockIo = io as jest.MockedFunction<typeof io>;

describe('RealTimeBooking', () => {
  let mockSocket: any;
  const mockProps = {
    selectedDate: '2024-10-15',
    serviceId: 1,
    onTimeSlotSelect: jest.fn(),
    onAvailabilityChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create mock socket
    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      close: jest.fn(),
      connected: true,
    };

    mockIo.mockReturnValue(mockSocket);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('initializes WebSocket connection on mount', () => {
    render(<RealTimeBooking {...mockProps} />);

    expect(mockIo).toHaveBeenCalledWith('', {
      path: '/api/ws/availability',
      transports: ['websocket', 'polling'],
    });

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('availability_update', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('booking_conflict', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('booking_hold_created', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('booking_error', expect.any(Function));
  });

  it('displays loading state initially', () => {
    render(<RealTimeBooking {...mockProps} />);

    expect(screen.getByText('Loading availability...')).toBeInTheDocument();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('shows connection status correctly', async () => {
    render(<RealTimeBooking {...mockProps} />);

    // Find the connect callback and simulate connection
    const connectCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'connect'
    )?.[1];

    act(() => {
      connectCallback?.();
    });

    await waitFor(() => {
      expect(screen.getByText('Real-time updates active')).toBeInTheDocument();
    });
  });

  it('displays availability data when received', async () => {
    const mockAvailabilityData = {
      date: '2024-10-15',
      timeSlots: [
        {
          id: '1',
          startTime: '09:00',
          endTime: '10:00',
          maxCapacity: 4,
          currentBookings: 1,
          availableCapacity: 3,
          isAvailable: true,
          availableBays: 2,
          conflicts: [],
        },
        {
          id: '2',
          startTime: '10:00',
          endTime: '11:00',
          maxCapacity: 4,
          currentBookings: 4,
          availableCapacity: 0,
          isAvailable: false,
          availableBays: 0,
          conflicts: [],
        },
      ],
      summary: {
        totalSlots: 2,
        availableSlots: 1,
        fullyBookedSlots: 1,
      },
    };

    render(<RealTimeBooking {...mockProps} />);

    // Simulate connection and availability update
    const connectCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'connect'
    )?.[1];
    const availabilityCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'availability_update'
    )?.[1];

    act(() => {
      connectCallback?.();
      availabilityCallback?.(mockAvailabilityData);
    });

    await waitFor(() => {
      expect(screen.getByText('Available Times for 10/15/2024')).toBeInTheDocument();
      expect(screen.getByText('09:00')).toBeInTheDocument();
      expect(screen.getByText('10:00')).toBeInTheDocument();
      expect(screen.getByText('1 of 2 slots available')).toBeInTheDocument();
    });

    expect(mockProps.onAvailabilityChange).toHaveBeenCalledWith(mockAvailabilityData);
  });

  it('handles time slot selection correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const mockAvailabilityData = {
      date: '2024-10-15',
      timeSlots: [
        {
          id: '1',
          startTime: '09:00',
          endTime: '10:00',
          maxCapacity: 4,
          currentBookings: 1,
          availableCapacity: 3,
          isAvailable: true,
          availableBays: 2,
          conflicts: [],
        },
      ],
      summary: {
        totalSlots: 1,
        availableSlots: 1,
        fullyBookedSlots: 0,
      },
    };

    render(<RealTimeBooking {...mockProps} />);

    // Setup connection and data
    const connectCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'connect'
    )?.[1];
    const availabilityCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'availability_update'
    )?.[1];

    act(() => {
      connectCallback?.();
      availabilityCallback?.(mockAvailabilityData);
    });

    await waitFor(() => {
      expect(screen.getByText('09:00')).toBeInTheDocument();
    });

    // Click on time slot
    const timeSlotButton = screen.getByText('09:00').closest('button');
    await user.click(timeSlotButton!);

    expect(mockSocket.emit).toHaveBeenCalledWith('attempt_booking', {
      date: '2024-10-15',
      timeSlot: '09:00',
      serviceId: 1,
    });
    expect(mockProps.onTimeSlotSelect).toHaveBeenCalledWith('09:00');
  });

  it('prevents selection of unavailable time slots', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const mockAvailabilityData = {
      date: '2024-10-15',
      timeSlots: [
        {
          id: '1',
          startTime: '09:00',
          endTime: '10:00',
          maxCapacity: 4,
          currentBookings: 4,
          availableCapacity: 0,
          isAvailable: false,
          availableBays: 0,
          conflicts: [],
        },
      ],
      summary: {
        totalSlots: 1,
        availableSlots: 0,
        fullyBookedSlots: 1,
      },
    };

    render(<RealTimeBooking {...mockProps} />);

    // Setup connection and data
    const connectCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'connect'
    )?.[1];
    const availabilityCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'availability_update'
    )?.[1];

    act(() => {
      connectCallback?.();
      availabilityCallback?.(mockAvailabilityData);
    });

    await waitFor(() => {
      expect(screen.getByText('09:00')).toBeInTheDocument();
    });

    // Try to click unavailable slot
    const timeSlotButton = screen.getByText('09:00').closest('button');
    expect(timeSlotButton).toBeDisabled();

    await user.click(timeSlotButton!);

    expect(mockSocket.emit).not.toHaveBeenCalledWith('attempt_booking', expect.any(Object));
    expect(mockProps.onTimeSlotSelect).not.toHaveBeenCalled();
  });

  it('displays booking hold information', async () => {
    const mockHoldData = {
      holdId: 'hold-123',
      expiresAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
      timeSlot: '09:00',
    };

    render(<RealTimeBooking {...mockProps} />);

    // Simulate booking hold creation
    const holdCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'booking_hold_created'
    )?.[1];

    act(() => {
      holdCallback?.(mockHoldData);
    });

    await waitFor(() => {
      expect(screen.getByText('Time slot reserved: 09:00')).toBeInTheDocument();
      expect(screen.getByText('Complete your booking within the time limit to secure this slot.')).toBeInTheDocument();
    });
  });

  it('handles booking conflicts', async () => {
    render(<RealTimeBooking {...mockProps} />);

    const conflictCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'booking_conflict'
    )?.[1];

    act(() => {
      conflictCallback?.({
        timeSlot: '09:00',
        conflicts: [{ message: 'Time slot no longer available' }],
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Booking conflict for 09:00: Time slot no longer available')).toBeInTheDocument();
    });
  });

  it('handles connection errors', async () => {
    render(<RealTimeBooking {...mockProps} />);

    const errorCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'connect_error'
    )?.[1];

    act(() => {
      errorCallback?.(new Error('Network error'));
    });

    await waitFor(() => {
      expect(screen.getByText('Connection failed: Network error')).toBeInTheDocument();
    });
  });

  it('handles booking hold expiration', async () => {
    const mockHoldData = {
      holdId: 'hold-123',
      expiresAt: new Date(Date.now() + 1000).toISOString(), // 1 second from now
      timeSlot: '09:00',
    };

    render(<RealTimeBooking {...mockProps} />);

    const holdCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'booking_hold_created'
    )?.[1];

    act(() => {
      holdCallback?.(mockHoldData);
    });

    // Fast-forward time to trigger expiration
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText('Booking hold expired. Please select a time slot again.')).toBeInTheDocument();
    });
  });

  it('subscribes to availability updates when date changes', () => {
    const { rerender } = render(<RealTimeBooking {...mockProps} />);

    // Simulate connection
    const connectCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'connect'
    )?.[1];

    act(() => {
      connectCallback?.();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_availability', {
      date: '2024-10-15',
      serviceId: 1,
    });

    // Change date
    rerender(<RealTimeBooking {...mockProps} selectedDate="2024-10-16" />);

    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe_availability', {
      date: '2024-10-15',
      serviceId: 1,
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_availability', {
      date: '2024-10-16',
      serviceId: 1,
    });
  });

  it('displays correct status colors for different slot states', async () => {
    const mockAvailabilityData = {
      date: '2024-10-15',
      timeSlots: [
        {
          id: '1',
          startTime: '09:00',
          endTime: '10:00',
          maxCapacity: 4,
          currentBookings: 1,
          availableCapacity: 3,
          isAvailable: true,
          availableBays: 2,
          conflicts: [],
        },
        {
          id: '2',
          startTime: '10:00',
          endTime: '11:00',
          maxCapacity: 4,
          currentBookings: 4,
          availableCapacity: 0,
          isAvailable: false,
          availableBays: 0,
          conflicts: [],
        },
        {
          id: '3',
          startTime: '11:00',
          endTime: '12:00',
          maxCapacity: 4,
          currentBookings: 3,
          availableCapacity: 1,
          isAvailable: true,
          availableBays: 1,
          conflicts: [],
        },
        {
          id: '4',
          startTime: '12:00',
          endTime: '13:00',
          maxCapacity: 4,
          currentBookings: 0,
          availableCapacity: 4,
          isAvailable: true,
          availableBays: 4,
          conflicts: [{ type: 'maintenance', message: 'Maintenance scheduled' }],
        },
      ],
      summary: {
        totalSlots: 4,
        availableSlots: 2,
        fullyBookedSlots: 1,
      },
    };

    render(<RealTimeBooking {...mockProps} />);

    const connectCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'connect'
    )?.[1];
    const availabilityCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'availability_update'
    )?.[1];

    act(() => {
      connectCallback?.();
      availabilityCallback?.(mockAvailabilityData);
    });

    await waitFor(() => {
      const slot1 = screen.getByText('09:00').closest('button');
      const slot2 = screen.getByText('10:00').closest('button');
      const slot3 = screen.getByText('11:00').closest('button');
      const slot4 = screen.getByText('12:00').closest('button');

      // Available slot (good capacity)
      expect(slot1).toHaveClass('bg-green-50');

      // Unavailable slot
      expect(slot2).toHaveClass('bg-gray-100');
      expect(slot2).toBeDisabled();

      // Low capacity slot
      expect(slot3).toHaveClass('bg-yellow-50');

      // Conflict slot
      expect(slot4).toHaveClass('bg-red-100');
      expect(slot4).toBeDisabled();
    });
  });

  it('cleans up socket connection on unmount', () => {
    const { unmount } = render(<RealTimeBooking {...mockProps} />);

    unmount();

    expect(mockSocket.close).toHaveBeenCalled();
  });

  it('displays no slots message when empty', async () => {
    const mockAvailabilityData = {
      date: '2024-10-15',
      timeSlots: [],
      summary: {
        totalSlots: 0,
        availableSlots: 0,
        fullyBookedSlots: 0,
      },
    };

    render(<RealTimeBooking {...mockProps} />);

    const connectCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'connect'
    )?.[1];
    const availabilityCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'availability_update'
    )?.[1];

    act(() => {
      connectCallback?.();
      availabilityCallback?.(mockAvailabilityData);
    });

    await waitFor(() => {
      expect(screen.getByText('No time slots available for this date.')).toBeInTheDocument();
    });
  });
});

// Add custom test ID data attributes to components for easier testing
const addTestIds = () => ({
  'data-testid': 'loader',
});

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Calendar: () => <div data-testid="calendar-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Users: () => <div data-testid="users-icon" />,
  AlertTriangle: () => <div data-testid="alert-icon" />,
  CheckCircle: () => <div data-testid="check-icon" />,
  Loader: (props: any) => <div data-testid="loader" {...props} />,
  Wifi: () => <div data-testid="wifi-icon" />,
  WifiOff: () => <div data-testid="wifi-off-icon" />,
}));