import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Custom500() {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold mb-4">500</h1>
        <p className="text-gray-600 mb-8">Jotain meni pieleen. Yritä uudelleen myöhemmin.</p>
        <Link href="/" className="text-purple-600 hover:text-purple-800 underline">Palaa etusivulle</Link>
      </main>
      <Footer />
    </>
  );
}
