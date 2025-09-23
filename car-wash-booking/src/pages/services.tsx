// ...existing code...
import Footer from '../components/Footer';
import Header from '../components/Header';
import SEO from '../components/SEO';
import ServicesGrid from '../components/ServicesGrid';
import { siteConfig } from '../lib/siteConfig';

type Props = {
  services: any[];
};

export default function Services({ services = [] }: Props) {
  return (
    <>
      <SEO
        title={`Palvelut - ${siteConfig.name}`}
        description="Tutustu laajaan palveluvalikoimaamme. Autopesu, vahaus, sisäpesu ja paljon muuta."
      />
      <Header />
      <main className="bg-gray-50 min-h-screen">
        <div className="bg-purple-600 py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Palvelumme
            </h1>
            <p className="text-xl text-purple-100 max-w-2xl mx-auto">
              Tarjoamme kattavan valikoiman autopesu- ja huoltopalveluita 
              ammattitaitoisella henkilökunnalla.
            </p>
          </div>
        </div>
        
        <section className="container mx-auto px-4 py-16">
          <ServicesGrid services={services} />
        </section>

        {/* Features */}
        <section className="bg-white py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Miksi valita meidät?</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Nopea palvelu</h3>
                <p className="text-gray-600">Tehokas palvelu ilman laatutason tinkimistä. Useimmat palvelut alle tunnissa.</p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Laaduntakuu</h3>
                <p className="text-gray-600">Emme ole tyytyväisiä ennen kuin sinä olet. 100% tyytyväisyystakuu kaikille palveluille.</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Ympäristöystävällinen</h3>
                <p className="text-gray-600">Käytämme ympäristöystävällisiä pesuaineita ja kierrätämme pesuvettä.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

// Temporarily disabled for static export
// export const getServerSideProps: GetServerSideProps = async () => {
//   const services = await prisma.service.findMany({
//     where: { isActive: true },
//     orderBy: { createdAt: 'asc' }
//   });

//   return {
//     props: {
//       services: JSON.parse(JSON.stringify(services))
//     }
//   };
// };