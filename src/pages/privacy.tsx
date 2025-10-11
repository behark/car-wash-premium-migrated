// ...existing code...
import Footer from '../components/Footer';
import Header from '../components/Header';
import SEO from '../components/SEO';

export default function Privacy() {
  return (
    <>
      <SEO title="Tietosuojaseloste" description="Tietosuojaseloste ja henkilötietojen käsittely." />
      <Header />
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-6">Tietosuojaseloste</h1>
        <p>Päivitettävä sisältö.</p>
      </main>
      <Footer />
    </>
  );
}
