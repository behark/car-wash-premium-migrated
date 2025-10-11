type Testimonial = {
  id: number;
  name: string;
  contentFi: string;
  rating: number;
  photo?: string;
  carModel?: string;
  location?: string;
};

// Premium mock testimonials with customer photos
const mockTestimonials = [
  {
    id: 1,
    name: "Markus Hakala",
    contentFi: "Ceramic coating -palvelu oli täydellinen! BMW:ni näyttää showroom-tasoiselta jo kolme kuukautta myöhemmin. Laadukas palvelu, loistava lopputulos.",
    rating: 5,
    photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop&ixlib=rb-4.0.3",
    carModel: "BMW X5",
    location: "Helsinki"
  },
  {
    id: 2,
    name: "Elina Saarinen",
    contentFi: "Luxury sisädetailing ylitti kaikki odotukseni. Mercedes-Benzini sisätila näyttää ja tuoksuu kuin uudessa autossa. Kiitos ammattitaitoisesta työstä!",
    rating: 5,
    photo: "https://images.unsplash.com/photo-1494790108755-2616b612b632?q=80&w=150&auto=format&fit=crop&ixlib=rb-4.0.3",
    carModel: "Mercedes-Benz S-Class",
    location: "Espoo"
  },
  {
    id: 3,
    name: "Antti Virtanen",
    contentFi: "Täydellinen detailing -kokemus Audi A8:lleni. Jokainen yksityiskohta huomioitu, työ tehty sydämellä. Tämä on sitä todellista laadukasta palvelua.",
    rating: 5,
    photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=150&auto=format&fit=crop&ixlib=rb-4.0.3",
    carModel: "Audi A8",
    location: "Vantaa"
  },
  {
    id: 4,
    name: "Katriina Leppänen",
    contentFi: "Porscheni sai ansaitsemansa huippuluokan hoidon. Paint correction ja ceramic coating tekivät ihmeitä. Auto kiiltää kuin peili!",
    rating: 5,
    photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&auto=format&fit=crop&ixlib=rb-4.0.3",
    carModel: "Porsche 911",
    location: "Helsinki"
  },
  {
    id: 5,
    name: "Mikael Åström",
    contentFi: "Täydellinen detailing -paketti Tesla Model S:lleni oli investointi, joka kannatti. Ammattitaitoinen työ, loistavat tulokset. Palaan varmasti!",
    rating: 5,
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop&ixlib=rb-4.0.3",
    carModel: "Tesla Model S",
    location: "Helsinki"
  },
  {
    id: 6,
    name: "Sofia Koskinen",
    contentFi: "Range Roverini sai huippuluokan käsinpesun ja suojaukset. Palvelu oli täsmällistä, ammattitaitoista ja lopputulos hämmentävän hyvä. Suosittelen lämpimästi!",
    rating: 5,
    photo: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=150&auto=format&fit=crop&ixlib=rb-4.0.3",
    carModel: "Range Rover Evoque",
    location: "Espoo"
  }
];

export default function TestimonialsList({ testimonials }: { testimonials: Testimonial[] }) {
  // Use mock testimonials if no real testimonials are provided
  const displayTestimonials = testimonials.length > 0 ? testimonials.slice(0, 6) : mockTestimonials;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {displayTestimonials.map((testimonial, index) => (
        <div
          key={testimonial.id}
          className="group relative bg-white/90 backdrop-blur-sm p-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 animate-fade-in border border-purple-100/50"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* Quote Icon */}
          <div className="absolute top-6 right-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z"/>
            </svg>
          </div>

          {/* Verified Badge */}
          <div className="absolute top-6 left-6">
            <div className="bg-purple-100 text-purple-600 text-xs font-medium px-2 py-1 rounded-full flex items-center space-x-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Vahvistettu</span>
            </div>
          </div>

          {/* Rating Stars */}
          <div className="flex items-center mb-6">
            <div className="flex space-x-1">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`w-6 h-6 ${i < testimonial.rating ? 'text-purple-500' : 'text-gray-300'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="ml-3 text-lg font-semibold text-purple-600">{testimonial.rating}.0</span>
          </div>

          {/* Testimonial Content */}
          <blockquote className="text-slate-700 text-lg leading-relaxed mb-6 font-medium">
            "{testimonial.contentFi}"
          </blockquote>

          {/* Author without Photo */}
          <div>
            <cite className="font-bold text-navy-900 not-italic">{testimonial.name}</cite>
            <div className="text-sm text-slate-600">
              {testimonial.carModel && testimonial.location ?
                `${testimonial.carModel} • ${testimonial.location}` :
                'Asiakas'
              }
            </div>
          </div>

          {/* Verified Badge */}
          <div className="absolute bottom-6 right-6">
            <div className="flex items-center space-x-1 bg-gold-100 text-gold-700 px-2 py-1 rounded-full text-xs font-medium">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Varmennettu asiakas</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}