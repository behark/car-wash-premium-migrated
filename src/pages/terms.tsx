// ...existing code...
import Footer from '../components/Footer';
import Header from '../components/Header';
import SEO from '../components/SEO';

export default function Terms() {
  return (
    <>
      <SEO title="Käyttöehdot" description="Sivuston käyttöehdot." />
      <Header />
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold mb-6">Käyttöehdot</h1>
        <p>Päivitettävä sisältö.</p>
      </main>
      <Footer />
    </>
  );
}
