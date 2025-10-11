import Link from 'next/link';
import { siteConfig } from '../lib/siteConfig';

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">{siteConfig.name}</h3>
            <p className="text-gray-300">{siteConfig.tagline}</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Pikalinkit</h3>
            <ul className="space-y-2">
              <li><Link href="/services" className="text-gray-300 hover:text-white">Palvelut</Link></li>
              <li><Link href="/booking" className="text-gray-300 hover:text-white">Varaa aika</Link></li>
              <li><Link href="/faq" className="text-gray-300 hover:text-white">UKK</Link></li>
              <li><Link href="/contact" className="text-gray-300 hover:text-white">Yhteystiedot</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Yhteystiedot</h3>
            <div className="text-gray-300 space-y-2">
              <p>{siteConfig.address.street}</p>
              {siteConfig.address.city && <p>{siteConfig.address.postalCode} {siteConfig.address.city}</p>}
              <p>{siteConfig.phone.display}</p>
              <p>{siteConfig.email}</p>
            </div>
          </div>
        </div>
        <hr className="my-8 border-gray-700" />
        <div className="text-center text-gray-300">
          <p>© {new Date().getFullYear()} {siteConfig.name}. Kaikki oikeudet pidätetään.</p>
          <div className="mt-2 space-x-4">
            <Link href="/privacy" className="hover:text-white">Tietosuojaseloste</Link>
            <Link href="/terms" className="hover:text-white">Käyttöehdot</Link>
            <Link href="/cookie" className="hover:text-white">Evästeet</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}