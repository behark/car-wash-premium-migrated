import { useState, FormEvent } from 'react';

export default function TestimonialForm() {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contentFi: content, rating })
      });
      
      if (response.ok) {
        setStatus('Kiitos palautteestasi! Arvostelu odottaa hyväksyntää.');
        setName('');
        setContent('');
        setRating(5);
      } else {
        setStatus('Virhe lähettäessä arvostelua. Yritä uudelleen.');
      }
    } catch (error) {
      setStatus('Virhe lähettäessä arvostelua. Yritä uudelleen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-8">
        <p className="text-green-800">{status}</p>
        <button 
          onClick={() => setStatus('')}
          className="mt-2 text-green-600 hover:text-green-800 underline"
        >
          Lähetä toinen arvostelu
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6 mt-8">
      <h3 className="text-xl font-semibold mb-4">Jätä arvostelu</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Nimi
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nimesi"
          />
        </div>
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            Arvostelusi
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Kerro kokemuksestasi..."
          />
        </div>
        <div>
          <label htmlFor="rating" className="block text-sm font-medium text-gray-700 mb-1">
            Arvosana
          </label>
          <select
            id="rating"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} / 5 {r === 5 ? '⭐⭐⭐⭐⭐' : r === 4 ? '⭐⭐⭐⭐' : r === 3 ? '⭐⭐⭐' : r === 2 ? '⭐⭐' : '⭐'}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          {isSubmitting ? 'Lähetetään...' : 'Lähetä arvostelu'}
        </button>
      </form>
    </div>
  );
}