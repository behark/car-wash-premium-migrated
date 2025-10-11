# PremiumAutoPesu Booking Website

**Teknologia:** Next.js (TypeScript), Tailwind CSS, PostgreSQL (Prisma), NextAuth.js, SendGrid, Twilio, Stripe.

**Kuvaus:** Autopesun ajanvarausjärjestelmä. Sivustolla käyttäjät voivat selata palveluja, varata aikoja ja lähettää viestejä. Administraattori voi hallita palveluja, varauksia, arvosteluja ja asetuksia dashboardin kautta.

## 🚀 Pikaohjeet

### 1. Asenna riippuvuudet
```bash
npm install
# tai
pnpm install
# tai
yarn install
```

### 2. Luo .env tiedosto
Kopioi `.env.example` ja nimeä se `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-change-this-in-production"
SENDGRID_API_KEY="SG.xxxxx"
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="xxxx"
TWILIO_FROM="+1234567890"
STRIPE_SECRET_KEY="sk_test_xxx"
GOOGLE_MAPS_API_KEY="your_google_maps_key"
```

Huom: Käytä julkisessa frontendissä muuttujaa `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. `.env.example` sisältää oikean nimen.

### 3. Tietokanta
```bash
# Suorita migraatiot
npx prisma migrate dev --name init

# Generoi Prisma client
npx prisma generate

# Täytä tietokanta testimateriaalilla
npx prisma db seed
```

### 4. Kehityspalvelin
```bash
npm run dev
```

Mene selaimessa osoitteeseen `http://localhost:3000`.

### 5. Testit
```bash
npm test
```

### 6. Rakennus
```bash
npm run build
npm start
```

## Brändäys ja yritystiedot

Yrityksen tiedot sijaitsevat tiedostossa `src/lib/siteConfig.ts`. Päivitä sieltä:

- `name`, `tagline`
- `phone.display` ja `phone.tel`
- `address.street` jne. sekä `mapsQuery`
- `hours`
- `logoPath` (oletus: `public/images/logo.svg`)

Header ja Footer lukevat nämä arvot automaattisesti.

### 7. Docker
```bash
docker-compose up --build
```

## 🔐 Käyttö (Admin)

- **Oletus-admin:** sähköposti `admin@example.com`, salasana `admin123`
- **Kirjaudu:** `http://localhost:3000/admin/login`
- **Dashboard:** Hallinnoi palveluja, varauksia, arvosteluja ja asetuksia

## 📚 API-dokumentaatio

### Julkiset API-päätepisteet

#### GET /api/services
Listaa kaikki aktiiviset palvelut.

**Vastaus:**
```json
[
  {
    "id": 1,
    "titleFi": "Peruspesu",
    "titleEn": "Basic Wash",
    "descriptionFi": "Sisältää ulkopesun ja kuivauksen.",
    "priceCents": 2500,
    "durationMinutes": 30,
    "capacity": 2,
    "image": "/images/service1.jpg"
  }
]
```

#### GET /api/services/[id]
Hae yksittäisen palvelun tiedot.

#### POST /api/bookings
Luo uuden varauksen.

**Pyyntö:**
```json
{
  "serviceId": 1,
  "vehicleType": "Henkilöauto",
  "date": "2025-09-30",
  "time": "10:00",
  "name": "Matti Meikäläinen",
  "email": "matti@example.com",
  "phone": "+358401234567",
  "licencePlate": "ABC-123",
  "notes": "Ei erityisvaatimuksia"
}
```

**Vastaus:**
```json
{
  "bookingId": 123,
  "status": "PENDING",
  "message": "Varaus luotu onnistuneesti"
}
```

#### POST /api/testimonials
Lähetä uusi arvostelu.

**Pyyntö:**
```json
{
  "name": "Asiakas",
  "contentFi": "Loistava palvelu!",
  "rating": 5
}
```

### Admin API-päätepisteet (vaatii kirjautumisen)

#### GET /api/admin/bookings
Listaa kaikki varaukset.

#### PUT /api/admin/bookings/[id]
Päivitä varauksen status.

**Pyyntö:**
```json
{
  "status": "CONFIRMED"
}
```

### cURL-esimerkit

**Luo varaus:**
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": 1,
    "vehicleType": "Henkilöauto",
    "date": "2025-09-30",
    "time": "10:00",
    "name": "Matti Meikäläinen",
    "email": "matti@example.com",
    "phone": "+358401234567",
    "licencePlate": "ABC-123",
    "notes": "Ei erityisvaatimuksia"
  }'
```

**Palveluiden lista:**
```bash
curl http://localhost:3000/api/services
```

## 🌐 Julkaisu

### Vercel
1. Luo tili [Vercel](https://vercel.com)
2. Yhdistä GitHub-repository
3. Lisää ympäristömuuttujat Vercel dashboardissa
4. Deploy automaattisesti

Tuotantomuistilista Vercelissä:
- Lisää `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ja muut tarvittavat avaimet.
- Aja migraatiot (esim. Vercel job tai ensikäynnistyksessä) tai käytä erillistä migraatiokomennon ajamista.
- Varmista että `prisma generate` ajetaan buildissä (Next tekee sen, kun Prisma on depenä).

### Docker
```bash
# Rakenna ja käynnistä
docker-compose up --build

# Taustalla
docker-compose up -d
```

### Manuaalinen
1. Rakenna sovellus: `npm run build`
2. Käynnistä: `npm start`
3. Varmista että tietokanta on käytettävissä

### Netlify

1. Luo uusi sivu Gitistä Netlifyssä.
2. Build command: `npm run build` ja Publish directory: `.next` (käytä Netlify Next.js -lisäosaa automaattiseen reititykseen).
3. Lisää ympäristömuuttujat Site settings → Build & deploy → Environment.
4. Ota käyttöön Next.js plugin Netlify Marketplace: "@netlify/plugin-nextjs" jos ei oletuksena.

Ympäristömuuttujat Netlifyssä:
- `DATABASE_URL` (SQLite: `file:./prisma/dev.db` tai tuotannossa Postgres URL)
- `NEXTAUTH_URL` (sivuston julkinen URL)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (kartta upotus)
- `NEXT_PUBLIC_HERO_IMAGE` (valinnainen: yliaja hero-kuva suoraan URL:lla)

Sivustolla löytyy `robots.txt` (public-kansiossa) ja dynaaminen `sitemap.xml` reitti hakukoneita varten.

## 🏗️ Arkkitehtuuri

### Teknologia-stack
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Tietokanta:** PostgreSQL, Prisma ORM
- **Autentikointi:** NextAuth.js
- **Sähköposti:** SendGrid
- **SMS:** Twilio
- **Maksut:** Stripe (valmisteltu)
- **Kartat:** Google Maps API

### Projektin rakenne
```
car-wash-booking/
├── .github/workflows/     # CI/CD
├── prisma/               # Tietokanta schema ja seed
├── public/               # Staattiset tiedostot
├── src/
│   ├── components/       # React komponentit
│   ├── lib/             # Apukirjastot
│   ├── pages/           # Next.js sivut ja API
│   └── styles/          # CSS tyylit
├── tests/               # Testit
└── docker-compose.yml   # Docker konfiguraatio
```

### Ominaisuudet

#### Julkiset sivut
- ✅ Etusivu (hero, palvelut, arvostelut)
- ✅ Palvelut (lista ja yksityiskohdat)
- ✅ Varauslomake (vaiheittainen)
- ✅ Galleria
- ✅ Arvostelut ja lomake
- ✅ UKK
- ✅ Yhteystiedot ja kartta
- ✅ Tietosuoja/käyttöehdot

#### Admin-hallinta
- ✅ Kirjautuminen
- ✅ Dashboard
- ✅ Palveluiden hallinta
- ✅ Varausten hallinta
- ✅ Arvostelut (hyväksyntä)
- ✅ Asetukset
- ✅ Kalenterinäkymä

#### Liiketoimintalogiikka
- ✅ Palveluilla kesto, hinta, kapasiteetti
- ✅ Varausten päällekkäisyyden esto
- ✅ Email/SMS vahvistukset
- ✅ Tila-automatiikka (PENDING → CONFIRMED → COMPLETED)

#### Kansainvälistäminen
- ✅ i18n konfiguraatio (fi/en)
- ✅ Sisältö pääosin suomeksi
- ✅ Rakenne tukee käännöksiä

#### Saavutettavuus & SEO
- ✅ Semanttinen HTML
- ✅ Meta-tagit
- ✅ Responsiivinen design
- ✅ Keyboard navigation

#### Suorituskyky
- ✅ Tailwind CSS (optimoitu)
- ✅ Next.js kuva-optimointi
- ✅ Static generation missä mahdollista
- ✅ API route caching

#### Turvallisuus
- ✅ NextAuth autentikointi
- ✅ Bcrypt salasanan hash
- ✅ Environment variables
- ✅ Input validointi

#### Kehittäjätyökalut
- ✅ TypeScript
- ✅ ESLint + Prettier
- ✅ Jest testit
- ✅ GitHub Actions CI/CD
- ✅ Docker support

## 🧪 Testaus

### Yksikkötestit
```bash
npm test
```

### End-to-end testit
```bash
# Tulossa: Playwright/Cypress testit
```

### Manuaalinen testaus
1. **Etusivu:** Tarkista että sisältö latautuu
2. **Palvelut:** Navigoi palvelulistaan ja yksityiskohtiin
3. **Varaus:** Täytä lomake ja lähetä
4. **Admin:** Kirjaudu ja hallinnoi varauksia

## 🔧 Kehitys

### Koodin laatu
```bash
# Linting
npm run lint

# Formatointi
npm run format
```

### Tietokanta
```bash
# Uusi migraatio
npx prisma migrate dev --name migration_name

# Reset tietokanta
npx prisma migrate reset

# Prisma Studio (GUI)
npx prisma studio
```

### Debuggaus
- NextAuth debug: Lisää `NEXTAUTH_DEBUG=true` .env
- Prisma debug: Lisää `DEBUG="prisma:*"` .env

## 📈 Seuranta ja analytiikka

### Suorituskyvyn seuranta
- Lighthouse audits
- Core Web Vitals
- Database query optimization

### Liiketoiminta-analytiikka
- Google Analytics (lisättävä)
- Varausten määrä ja trendit
- Suosituimmat palvelut

## 🤝 Kontribuointi

1. Fork projekti
2. Luo feature branch (`git checkout -b feature/amazing-feature`)
3. Commit muutokset (`git commit -m 'Add amazing feature'`)
4. Push branchiin (`git push origin feature/amazing-feature`)
5. Avaa Pull Request

## 📄 Lisenssi

MIT License - katso [LICENSE](LICENSE) tiedosto.

## 📞 Tuki

- **Dokumentaatio:** Tämä README
- **Issues:** GitHub Issues
- **Kehittäjä:** Ota yhteyttä projektin maintaineriin

---

**PremiumAutoPesu** - Ammattitaitoista autopesupalvelua verkossa 🚗✨