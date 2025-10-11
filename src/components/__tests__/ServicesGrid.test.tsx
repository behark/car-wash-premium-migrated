import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServicesGrid from '../ServicesGrid';

// Mock Next.js components
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props} data-testid="service-link">
        {children}
      </a>
    );
  };
});

jest.mock('next/image', () => {
  return function MockImage({ src, alt, priority, ...props }: any) {
    return (
      <img
        src={src}
        alt={alt}
        data-testid="service-image"
        data-priority={priority}
        {...props}
      />
    );
  };
});

describe('ServicesGrid', () => {
  const mockServices = [
    {
      id: 1,
      titleFi: 'Basic Wash',
      descriptionFi: 'Complete exterior and interior cleaning',
      priceCents: 1500,
      durationMinutes: 45,
      image: 'https://example.com/image1.jpg',
    },
    {
      id: 2,
      titleFi: 'Premium Wash',
      descriptionFi: 'Premium wash with waxing for lasting protection',
      priceCents: 2500,
      durationMinutes: 75,
      image: 'https://example.com/image2.jpg',
    },
    {
      id: 3,
      titleFi: 'Luxury Detail',
      descriptionFi: 'Complete luxury detailing service',
      priceCents: 5000,
      durationMinutes: 120,
      image: 'https://example.com/image3.jpg',
    },
  ];

  it('renders services correctly', () => {
    render(<ServicesGrid services={mockServices} />);

    expect(screen.getByText('Basic Wash')).toBeInTheDocument();
    expect(screen.getByText('Premium Wash')).toBeInTheDocument();
    expect(screen.getByText('Luxury Detail')).toBeInTheDocument();

    expect(screen.getByText('Complete exterior and interior cleaning')).toBeInTheDocument();
    expect(screen.getByText('Premium wash with waxing for lasting protection')).toBeInTheDocument();
  });

  it('displays correct pricing', () => {
    render(<ServicesGrid services={mockServices} />);

    expect(screen.getByText('15€')).toBeInTheDocument(); // 1500 cents = 15€
    expect(screen.getByText('25€')).toBeInTheDocument(); // 2500 cents = 25€
    expect(screen.getByText('50€')).toBeInTheDocument(); // 5000 cents = 50€
  });

  it('shows luxury badge for expensive services', () => {
    render(<ServicesGrid services={mockServices} />);

    // Luxury badge should appear for services >= 5000 cents (50€)
    expect(screen.getByText('LUXURY')).toBeInTheDocument();

    // Only one luxury badge should be present (for the 5000 cent service)
    expect(screen.getAllByText('LUXURY')).toHaveLength(1);
  });

  it('renders correct booking links', () => {
    render(<ServicesGrid services={mockServices} />);

    const bookingLinks = screen.getAllByTestId('service-link');
    expect(bookingLinks).toHaveLength(3);

    expect(bookingLinks[0]).toHaveAttribute('href', '/services/1');
    expect(bookingLinks[1]).toHaveAttribute('href', '/services/2');
    expect(bookingLinks[2]).toHaveAttribute('href', '/services/3');
  });

  it('displays service images with correct attributes', () => {
    render(<ServicesGrid services={mockServices} />);

    const images = screen.getAllByTestId('service-image');
    expect(images).toHaveLength(3);

    expect(images[0]).toHaveAttribute('src', 'https://example.com/image1.jpg');
    expect(images[0]).toHaveAttribute('alt', 'Basic Wash');
    expect(images[0]).toHaveAttribute('data-priority', 'true'); // First image should have priority

    expect(images[1]).toHaveAttribute('src', 'https://example.com/image2.jpg');
    expect(images[1]).toHaveAttribute('alt', 'Premium Wash');

    expect(images[2]).toHaveAttribute('src', 'https://example.com/image3.jpg');
    expect(images[2]).toHaveAttribute('alt', 'Luxury Detail');
  });

  it('uses fallback images when no image URL provided', () => {
    const servicesWithoutImages = [
      {
        id: 1,
        titleFi: 'Test Service',
        descriptionFi: 'Test description',
        priceCents: 1000,
        durationMinutes: 30,
      },
    ];

    render(<ServicesGrid services={servicesWithoutImages} />);

    const image = screen.getByTestId('service-image');
    expect(image).toHaveAttribute('src', '/images/service1.svg');
  });

  it('displays satisfaction guarantee badge', () => {
    render(<ServicesGrid services={mockServices} />);

    const guaranteeBadges = screen.getAllByText('100% Tyytyväisyystakuu');
    expect(guaranteeBadges).toHaveLength(3); // One for each service
  });

  it('applies correct grid layout classes', () => {
    const { container } = render(<ServicesGrid services={mockServices} />);

    const gridContainer = container.firstChild;
    expect(gridContainer).toHaveClass(
      'grid',
      'md:grid-cols-2',
      'lg:grid-cols-3',
      'xl:grid-cols-4',
      'gap-8'
    );
  });

  it('shows animation delays for staggered effect', () => {
    const { container } = render(<ServicesGrid services={mockServices} />);

    const serviceCards = container.querySelectorAll('.animate-fade-in');
    expect(serviceCards).toHaveLength(3);

    // Check animation delays
    expect(serviceCards[0]).toHaveStyle('animation-delay: 0ms');
    expect(serviceCards[1]).toHaveStyle('animation-delay: 150ms');
    expect(serviceCards[2]).toHaveStyle('animation-delay: 300ms');
  });

  it('handles empty services array by showing mock services', () => {
    render(<ServicesGrid services={[]} />);

    // Should show mock services when empty array is provided
    expect(screen.getByText('Peruspesu')).toBeInTheDocument();
    expect(screen.getByText('Erikoispesu')).toBeInTheDocument();
    expect(screen.getByText('Renkaiden vaihto & säilytys')).toBeInTheDocument();
  });

  it('handles mixed pricing correctly', () => {
    const mixedPriceServices = [
      {
        id: 1,
        titleFi: 'Cheap Service',
        descriptionFi: 'Low cost service',
        priceCents: 999, // 9.99€ - should display as 10€
        durationMinutes: 30,
      },
      {
        id: 2,
        titleFi: 'Exact Price',
        descriptionFi: 'Exact euro amount',
        priceCents: 2000, // 20.00€ - should display as 20€
        durationMinutes: 45,
      },
    ];

    render(<ServicesGrid services={mixedPriceServices} />);

    expect(screen.getByText('10€')).toBeInTheDocument(); // Rounded up from 9.99
    expect(screen.getByText('20€')).toBeInTheDocument(); // Exact amount
  });

  it('applies hover effects classes', () => {
    const { container } = render(<ServicesGrid services={mockServices} />);

    const serviceCards = container.querySelectorAll('.group');
    expect(serviceCards).toHaveLength(3);

    serviceCards.forEach(card => {
      expect(card).toHaveClass(
        'hover:shadow-2xl',
        'transition-all',
        'duration-500',
        'transform',
        'hover:-translate-y-2'
      );
    });
  });

  it('renders booking buttons with correct styling', () => {
    render(<ServicesGrid services={mockServices} />);

    const bookingButtons = screen.getAllByText('Varaa nyt');
    expect(bookingButtons).toHaveLength(3);

    bookingButtons.forEach(button => {
      expect(button).toHaveClass(
        'bg-gradient-to-r',
        'from-purple-600',
        'to-purple-700',
        'hover:from-purple-700',
        'hover:to-purple-800',
        'text-white'
      );
    });
  });

  it('displays pricing section correctly', () => {
    render(<ServicesGrid services={mockServices} />);

    const priceLabels = screen.getAllByText('Alkaen');
    expect(priceLabels).toHaveLength(3);

    // Check that price and label are in the same section
    priceLabels.forEach(label => {
      const parent = label.parentElement;
      expect(parent).toHaveClass('text-left');
    });
  });

  it('handles services with very long descriptions', () => {
    const servicesWithLongDescription = [
      {
        id: 1,
        titleFi: 'Service with Long Description',
        descriptionFi: 'This is a very long description that should be truncated because it exceeds the normal length that would fit nicely in the card layout and could potentially break the design if not handled properly',
        priceCents: 1500,
        durationMinutes: 45,
      },
    ];

    render(<ServicesGrid services={servicesWithLongDescription} />);

    const description = screen.getByText(/This is a very long description/);
    expect(description).toHaveClass('line-clamp-2'); // Should be truncated
  });

  it('applies correct CSS classes for premium cards', () => {
    const { container } = render(<ServicesGrid services={mockServices} />);

    const premiumCards = container.querySelectorAll('.premium-card');
    expect(premiumCards).toHaveLength(3);

    premiumCards.forEach(card => {
      expect(card).toHaveClass(
        'bg-white',
        'rounded-2xl',
        'shadow-lg',
        'overflow-hidden'
      );
    });
  });

  it('handles services without images gracefully', () => {
    const servicesWithMissingImages = [
      {
        id: 999,
        titleFi: 'No Image Service',
        descriptionFi: 'Service without image URL',
        priceCents: 1500,
        durationMinutes: 45,
        // image property is undefined
      },
    ];

    render(<ServicesGrid services={servicesWithMissingImages} />);

    const image = screen.getByTestId('service-image');
    expect(image).toHaveAttribute('src', '/images/service999.svg');
    expect(image).toHaveAttribute('alt', 'No Image Service');
  });

  it('sets priority loading only for first 4 images', () => {
    const manyServices = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      titleFi: `Service ${index + 1}`,
      descriptionFi: `Description ${index + 1}`,
      priceCents: 1500,
      durationMinutes: 45,
    }));

    render(<ServicesGrid services={manyServices} />);

    const images = screen.getAllByTestId('service-image');

    // First 4 images should have priority
    for (let i = 0; i < 4; i++) {
      expect(images[i]).toHaveAttribute('data-priority', 'true');
    }

    // Remaining images should not have priority
    for (let i = 4; i < images.length; i++) {
      expect(images[i]).toHaveAttribute('data-priority', 'false');
    }
  });

  it('handles interaction with booking buttons', async () => {
    const user = userEvent.setup();
    render(<ServicesGrid services={mockServices} />);

    const firstBookingButton = screen.getAllByText('Varaa nyt')[0];

    // Should be clickable
    expect(firstBookingButton.closest('a')).toHaveAttribute('href', '/services/1');

    // Simulate click
    await user.click(firstBookingButton);

    // In a real app, this would navigate to the booking page
    // Here we just verify the link structure is correct
  });
});