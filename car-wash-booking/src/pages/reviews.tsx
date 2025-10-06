import { useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { siteConfig } from '../lib/siteConfig';

export default function Reviews() {
  const router = useRouter();
  const { code } = router.query;

  const [formData, setFormData] = useState({
    confirmationCode: (code as string) || '',
    customerName: '',
    customerEmail: '',
    rating: 5,
    title: '',
    content: '',
    serviceRating: 5,
    staffRating: 5,
    facilityRating: 5,
    recommendToFriend: true,
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/reviews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message || 'Arvostelun lähettäminen epäonnistui');
      }
    } catch (error) {
      setError('Virhe arvostelun lähettämisessä');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <SEO
          title={`Kiitos arvostelusta - ${siteConfig.name}`}
          description="Arvostelusi on vastaanotettu"
        />
        <Header />

        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-24">
          <div className="container mx-auto px-4 max-w-2xl text-center">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>

              <h1 className="text-3xl font-bold text-slate-900 mb-4">
                Kiitos arvostelustasi! ⭐
              </h1>

              <p className="text-lg text-slate-600 mb-6">
                Arvostelusti on vastaanotettu ja näkyy sivustolla hyväksynnän jälkeen.
                Palautteesi auttaa meitä kehittämään palveluamme!
              </p>

              <div className="space-y-4">
                <a
                  href="/booking"
                  className="inline-block bg-gradient-to-r from-gold-500 to-gold-600 text-white font-semibold px-8 py-4 rounded-xl hover:from-gold-600 hover:to-gold-700 transition-all duration-300 transform hover:scale-105"
                >
                  Varaa uusi aika
                </a>

                <div className="text-sm">
                  <a href="/" className="text-slate-600 hover:text-slate-900 underline">
                    Palaa etusivulle
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </>
    );
  }

  const StarRating = ({ rating, onChange, label }: { rating: number; onChange: (rating: number) => void; label: string }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`w-8 h-8 rounded-full ${
              star <= rating ? 'text-yellow-400' : 'text-slate-300'
            } hover:text-yellow-400 transition-colors`}
          >
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <SEO
        title={`Jätä arvostelu - ${siteConfig.name}`}
        description="Kerro kokemuksestasi ja auta muita asiakkaita"
      />
      <Header />

      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-24">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Jätä arvostelu
            </h1>
            <p className="text-xl text-slate-600">
              Kerro kokemuksestasi ja auta muita asiakkaita!
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nimi *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="Etunimi Sukunimi"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Sähköposti *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="etunimi@email.com"
                  />
                </div>
              </div>

              {/* Confirmation Code */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vahvistuskoodi (jos käytettävissä)
                </label>
                <input
                  type="text"
                  value={formData.confirmationCode}
                  onChange={(e) => setFormData({ ...formData, confirmationCode: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
                  placeholder="ABCD1234"
                  maxLength={8}
                />
              </div>

              {/* Overall Rating */}
              <div className="bg-amber-50 rounded-xl p-6">
                <StarRating
                  rating={formData.rating}
                  onChange={(rating) => setFormData({ ...formData, rating })}
                  label="Kokonaisarvosana *"
                />
              </div>

              {/* Review Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Arvostelun otsikko *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Esim. Erinomainen palvelu ja siistit tilat"
                />
              </div>

              {/* Review Content */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Arvostelu *
                </label>
                <textarea
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  rows={4}
                  placeholder="Kerro kokemuksestasi... Mikä oli hienoa? Mitä voisi parantaa?"
                />
              </div>

              {/* Detailed Ratings */}
              <div className="grid md:grid-cols-3 gap-6 bg-slate-50 rounded-xl p-6">
                <StarRating
                  rating={formData.serviceRating}
                  onChange={(serviceRating) => setFormData({ ...formData, serviceRating })}
                  label="Palvelun laatu"
                />
                <StarRating
                  rating={formData.staffRating}
                  onChange={(staffRating) => setFormData({ ...formData, staffRating })}
                  label="Henkilökunta"
                />
                <StarRating
                  rating={formData.facilityRating}
                  onChange={(facilityRating) => setFormData({ ...formData, facilityRating })}
                  label="Tilat ja siisteys"
                />
              </div>

              {/* Recommendation */}
              <div className="bg-green-50 rounded-xl p-6">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.recommendToFriend}
                    onChange={(e) => setFormData({ ...formData, recommendToFriend: e.target.checked })}
                    className="w-5 h-5 text-green-600 border-slate-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Suosittelen tätä yritystä ystävilleni ja perheelleni
                  </span>
                </label>
              </div>

              {/* Submit */}
              <div className="text-center pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:transform-none"
                >
                  {loading ? 'Lähetetään...' : 'Lähetä arvostelu'}
                </button>

                <p className="text-xs text-slate-500 mt-3">
                  Arvosteluusi tarkistetaan ennen julkaisua
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}