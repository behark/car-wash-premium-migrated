// ...existing code...
import Footer from '../components/Footer';
import Header from '../components/Header';
import SEO from '../components/SEO';

export default function FAQ() {
  return (
    <>
      <SEO title="UKK - Usein kysytyt kysymykset" description="Usein kysytyt kysymykset autopesupalveluista." />
      <Header />
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-6">Usein kysytyt kysymykset</h1>
        <p>Lisää sisältö tähän.</p>
      </main>
      <Footer />
    </>
  );
}
