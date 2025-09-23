import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Custom404() {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold mb-4">404</h1>
        <p className="text-gray-600 mb-8">Sivua ei löytynyt.</p>
        <Link href="/" className="text-purple-600 hover:text-purple-800 underline">Palaa etusivulle</Link>
      </main>
      <Footer />
    </>
  );
}
