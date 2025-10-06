import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import SEO from '../../components/SEO';
import { siteConfig } from '../../lib/siteConfig';
import { format } from 'date-fns';

interface Booking {
  id: number;
  confirmationCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  service: {
    titleFi: string;
    priceCents: number;
  };
}

export default function AdminBookings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/admin/login');
      return;
    }

    fetchBookings();
  }, [session, status, router]);

  const fetchBookings = async () => {
    try {
      const response = await fetch('/api/admin/dashboard-stats');
      const data = await response.json();

      if (data.success) {
        setBookings(data.recentBookings || []);
      } else {
        setError('Varausten lataus epäonnistui');
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      setError('Virhe varausten hakemisessa');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bookingId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (response.ok) {
        // Refresh bookings to show updated status
        fetchBookings();
        alert(`Varaus ${newStatus === 'CONFIRMED' ? 'vahvistettu' : 'päivitetty'} onnistuneesti!`);
      } else {
        alert('Virhe varauksen päivityksessä');
      }
    } catch (error) {
      console.error('Status update error:', error);
      alert('Virhe varauksen päivityksessä');
    }
  };

  const showBookingDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowDetails(true);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-amber-500 rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Ladataan varauksia...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      <SEO
        title={`Varaukset - Admin - ${siteConfig.name}`}
        description="Hallinnoi asiakasvarauksia"
      />

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link
                  href="/admin"
                  className="text-slate-600 hover:text-slate-900"
                >
                  ← Takaisin
                </Link>
                <h1 className="text-xl font-semibold text-slate-900">Varausten Hallinta</h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={fetchBookings}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Päivitä
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {/* Bookings Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Kaikki Varaukset ({bookings.length})
                </h2>
                <a
                  href="/booking"
                  target="_blank"
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  + Uusi varaus
                </a>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Vahvistuskoodi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Asiakas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Aika
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Palvelu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Hinta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Tila
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Toiminnot
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        <div className="space-y-2">
                          <div>Ei varauksia vielä</div>
                          <div className="text-sm">
                            <a href="/booking" target="_blank" className="text-amber-600 hover:text-amber-700">
                              Tee ensimmäinen varaus →
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    bookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900 font-mono">
                            {booking.confirmationCode}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {booking.customerName}
                            </div>
                            <div className="text-sm text-slate-500">{booking.customerPhone}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm text-slate-900">
                              {format(new Date(booking.date), 'dd.MM.yyyy')}
                            </div>
                            <div className="text-sm text-slate-500">
                              {booking.startTime} - {booking.endTime}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {booking.service.titleFi}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {(booking.service.priceCents / 100).toFixed(0)}€
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            booking.status === 'CONFIRMED'
                              ? 'bg-green-100 text-green-800'
                              : booking.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : booking.status === 'COMPLETED'
                              ? 'bg-blue-100 text-blue-800'
                              : booking.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleStatusChange(booking.id, 'CONFIRMED')}
                            className="text-green-600 hover:text-green-900"
                          >
                            ✅ Vahvista
                          </button>
                          <a
                            href={`tel:${booking.customerPhone}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            📞 Soita
                          </a>
                          <button
                            onClick={() => showBookingDetails(booking)}
                            className="text-amber-600 hover:text-amber-900"
                          >
                            👁️ Näytä
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Yhteenveto</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-amber-600">{bookings.length}</div>
                <div className="text-sm text-slate-600">Varauksia yhteensä</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {bookings.filter(b => b.status === 'CONFIRMED').length}
                </div>
                <div className="text-sm text-slate-600">Vahvistettuja</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {bookings.filter(b => b.status === 'PENDING').length}
                </div>
                <div className="text-sm text-slate-600">Odottavia</div>
              </div>
            </div>
          </div>
        </main>

        {/* Booking Details Modal */}
        {showDetails && selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">
                    Varaus {selectedBooking.confirmationCode}
                  </h2>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Customer Info */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">Asiakastiedot</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600">Nimi:</span>
                        <div className="font-medium">{selectedBooking.customerName}</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Puhelin:</span>
                        <div className="font-medium">
                          <a href={`tel:${selectedBooking.customerPhone}`} className="text-blue-600 hover:underline">
                            {selectedBooking.customerPhone}
                          </a>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-slate-600">Sähköposti:</span>
                        <div className="font-medium">
                          <a href={`mailto:${selectedBooking.customerEmail}`} className="text-blue-600 hover:underline">
                            {selectedBooking.customerEmail}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Booking Details */}
                  <div className="bg-amber-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">Varauksen tiedot</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600">Palvelu:</span>
                        <div className="font-medium">{selectedBooking.service.titleFi}</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Hinta:</span>
                        <div className="font-medium">{(selectedBooking.service.priceCents / 100).toFixed(0)}€</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Päivä:</span>
                        <div className="font-medium">{format(new Date(selectedBooking.date), 'dd.MM.yyyy')}</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Aika:</span>
                        <div className="font-medium">{selectedBooking.startTime} - {selectedBooking.endTime}</div>
                      </div>
                    </div>
                  </div>

                  {/* Status Actions */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">Varauksen tila</h3>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          handleStatusChange(selectedBooking.id, 'CONFIRMED');
                          setShowDetails(false);
                        }}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        ✅ Vahvista varaus
                      </button>
                      <button
                        onClick={() => {
                          handleStatusChange(selectedBooking.id, 'COMPLETED');
                          setShowDetails(false);
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        ✅ Merkitse valmiiksi
                      </button>
                      <button
                        onClick={() => {
                          handleStatusChange(selectedBooking.id, 'CANCELLED');
                          setShowDetails(false);
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
                      >
                        ❌ Peruuta
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}