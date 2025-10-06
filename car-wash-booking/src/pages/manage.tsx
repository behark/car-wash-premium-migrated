import { useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { siteConfig } from '../lib/siteConfig';
import { format } from 'date-fns';

interface BookingData {
  booking: {
    id: number;
    confirmationCode: string;
    service: {
      titleFi: string;
      priceCents: number;
      durationMinutes: number;
    };
    date: string;
    startTime: string;
    endTime: string;
    vehicleType: string;
    licensePlate?: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    status: string;
    canModify: boolean;
    hoursUntilBooking: number;
    notes?: string;
  };
  customer?: {
    loyaltyTier: string;
    loyaltyPoints: number;
    totalSpent: number;
    visitCount: number;
  };
}

export default function ManageBooking() {
  const router = useRouter();
  const [confirmationCode, setConfirmationCode] = useState('');
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const handleLookup = async () => {
    if (!confirmationCode.trim()) {
      setError('Syötä vahvistuskoodi');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/bookings/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationCode: confirmationCode.toUpperCase(),
          action: 'view',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setBookingData(data.data);
      } else {
        setError(data.message || 'Varausta ei löytynyt');
      }
    } catch (error) {
      setError('Virhe varausta haettaessa');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!bookingData || !confirm('Oletko varma että haluat perua varauksen?')) return;

    setLoading(true);
    try {
      const response = await fetch('/api/bookings/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationCode: confirmationCode.toUpperCase(),
          action: 'cancel',
          cancellationReason: 'Asiakas peruutti itse',
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Varaus peruutettu onnistuneesti!');
        setBookingData(null);
        setConfirmationCode('');
      } else {
        setError(data.message || 'Peruutus epäonnistui');
      }
    } catch (error) {
      setError('Virhe peruutuksessa');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!bookingData || !newDate || !newTime) {
      setError('Valitse uusi päivä ja aika');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/bookings/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationCode: confirmationCode.toUpperCase(),
          action: 'reschedule',
          newDate,
          newStartTime: newTime,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Varaus siirretty onnistuneesti!');
        setShowReschedule(false);
        handleLookup(); // Refresh booking data
      } else {
        setError(data.message || 'Varauksen siirtäminen epäonnistui');
      }
    } catch (error) {
      setError('Virhe varauksen siirrossa');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM': return 'text-purple-600';
      case 'GOLD': return 'text-yellow-600';
      case 'SILVER': return 'text-gray-600';
      default: return 'text-orange-600';
    }
  };

  return (
    <>
      <SEO
        title={`Hallinnoi varausta - ${siteConfig.name}`}
        description="Tarkista, muuta tai peruuta varauksesi"
      />
      <Header />

      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-24">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Hallinnoi Varaustasi
            </h1>
            <p className="text-xl text-slate-600">
              Syötä vahvistuskoodi tarkastellaksesi tai muuttaaksesi varaustasi
            </p>
          </div>

          {/* Confirmation Code Input */}
          {!bookingData && (
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
              <div className="max-w-md mx-auto">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vahvistuskoodi
                </label>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    placeholder="Syötä 8-merkkinen koodi"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-center"
                    maxLength={8}
                  />
                  <button
                    onClick={handleLookup}
                    disabled={loading || confirmationCode.length !== 8}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl transition-colors"
                  >
                    {loading ? '...' : 'Hae'}
                  </button>
                </div>
                {error && (
                  <p className="text-red-600 text-sm mt-2">{error}</p>
                )}
                <p className="text-xs text-slate-500 mt-3 text-center">
                  Vahvistuskoodi lähetettiin sinulle varauksen yhteydessä
                </p>
              </div>
            </div>
          )}

          {/* Booking Details */}
          {bookingData && (
            <div className="space-y-6">
              {/* Booking Info */}
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">
                    Varaus {bookingData.booking.confirmationCode}
                  </h2>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(bookingData.booking.status)}`}>
                    {bookingData.booking.status}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <div>
                      <span className="text-slate-600">Palvelu:</span>
                      <div className="font-semibold">{bookingData.booking.service.titleFi}</div>
                    </div>
                    <div>
                      <span className="text-slate-600">Päivä & aika:</span>
                      <div className="font-semibold">
                        {format(new Date(bookingData.booking.date), 'dd.MM.yyyy')} klo {bookingData.booking.startTime}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-600">Ajoneuvon tyyppi:</span>
                      <div className="font-semibold">{bookingData.booking.vehicleType}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-slate-600">Hinta:</span>
                      <div className="font-semibold">{(bookingData.booking.service.priceCents / 100).toFixed(0)}€</div>
                    </div>
                    <div>
                      <span className="text-slate-600">Kesto:</span>
                      <div className="font-semibold">{bookingData.booking.service.durationMinutes} min</div>
                    </div>
                    {bookingData.booking.licensePlate && (
                      <div>
                        <span className="text-slate-600">Rekisteri:</span>
                        <div className="font-semibold">{bookingData.booking.licensePlate}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Loyalty Info */}
                {bookingData.customer && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <h3 className="font-semibold text-slate-900 mb-2">🏆 Kanta-asiakastiedot</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-slate-600">Taso:</span>
                        <div className={`font-semibold ${getTierColor(bookingData.customer.loyaltyTier)}`}>
                          {bookingData.customer.loyaltyTier}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-600">Pisteet:</span>
                        <div className="font-semibold">{bookingData.customer.loyaltyPoints}</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Käynnit:</span>
                        <div className="font-semibold">{bookingData.customer.visitCount}</div>
                      </div>
                      <div>
                        <span className="text-slate-600">Kulutus:</span>
                        <div className="font-semibold">{(bookingData.customer.totalSpent / 100).toFixed(0)}€</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {bookingData.booking.canModify && bookingData.booking.status === 'PENDING' && (
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => setShowReschedule(!showReschedule)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl transition-colors"
                    >
                      📅 Siirrä varausta
                    </button>
                    <button
                      onClick={handleCancel}
                      className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl transition-colors"
                    >
                      ❌ Peruuta varaus
                    </button>
                  </div>
                )}

                {!bookingData.booking.canModify && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-blue-800">
                      ⏰ Varaus on liian lähellä muutettavaksi (alle 2h).
                      <br />
                      <strong>Ota yhteyttä:</strong> 044 960 8148
                    </p>
                  </div>
                )}
              </div>

              {/* Reschedule Form */}
              {showReschedule && (
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Siirrä varaus uudelle ajalle</h3>
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Uusi päivä
                      </label>
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Uusi aika
                      </label>
                      <select
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      >
                        <option value="">Valitse aika</option>
                        {Array.from({ length: 9 }, (_, i) => {
                          const hour = 9 + i;
                          const time = `${hour.toString().padStart(2, '0')}:00`;
                          return (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="flex space-x-4 justify-center">
                    <button
                      onClick={handleReschedule}
                      disabled={!newDate || !newTime || loading}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl transition-colors"
                    >
                      {loading ? 'Siirretään...' : 'Vahvista siirto'}
                    </button>
                    <button
                      onClick={() => setShowReschedule(false)}
                      className="bg-slate-500 hover:bg-slate-600 text-white px-6 py-3 rounded-xl transition-colors"
                    >
                      Peruuta
                    </button>
                  </div>
                </div>
              )}

              {/* Back to booking */}
              <div className="text-center">
                <button
                  onClick={() => {
                    setBookingData(null);
                    setConfirmationCode('');
                    setError('');
                    setShowReschedule(false);
                  }}
                  className="text-amber-600 hover:text-amber-700 underline"
                >
                  ← Hae toinen varaus
                </button>
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="bg-slate-100 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Tarvitsetko apua?</h3>
            <p className="text-slate-600 mb-6">
              Jos et löydä vahvistuskoodia tai tarvitset muuta apua, ota yhteyttä
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="tel:+358449608148"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl transition-colors"
              >
                📞 044 960 8148
              </a>
              <a
                href="mailto:Info@kiiltoloisto.fi"
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl transition-colors"
              >
                📧 Info@kiiltoloisto.fi
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}