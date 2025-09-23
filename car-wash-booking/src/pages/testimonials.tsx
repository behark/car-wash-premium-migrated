// ...existing code...
import Footer from '../components/Footer';
import Header from '../components/Header';
import SEO from '../components/SEO';
import TestimonialForm from '../components/TestimonialForm';
import TestimonialsList from '../components/TestimonialsList';
import { siteConfig } from '../lib/siteConfig';

export default function Testimonials({ testimonials = [] }: { testimonials: any[] }) {
  return (
    <>
      <SEO title={`Arvostelut - ${siteConfig.name}`} description="Asiakaskokemukset ja arvostelut." />
      <Header />
      <main className="bg-gray-50 min-h-screen">
        <section className="container mx-auto px-4 py-16">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">Asiakaskokemukset</h1>
          <p className="text-center text-gray-600 mb-12">Lue asiakkaidemme jättämiä arvosteluja ja jaa omasi.</p>
          <TestimonialsList testimonials={testimonials} />
          <div className="max-w-2xl mx-auto mt-12">
            <TestimonialForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

// Temporarily disabled for static export
// export async function getServerSideProps() {
//   try {
//     const testimonials = await prisma.testimonial.findMany({
//       where: { approved: true },
//       take: 20,
//       orderBy: { createdAt: 'desc' }
//     });
//     return { props: { testimonials: JSON.parse(JSON.stringify(testimonials)) } };
//   } catch (error) {
//     console.error('Failed to load testimonials:', error);
//     return { props: { testimonials: [] } };
//   }
// }
