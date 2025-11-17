// ... (imports and other components remain the same)

const Index = () => {
  // ... (existing state and functions)

  const categories = [
    { icon: Calendar, title: "Trips", path: "/category/trips", bgImage: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800" },
    { icon: PartyPopper, title: "Events", path: "/category/events", bgImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800" },
    { icon: Hotel, title: "Hotels", path: "/category/hotels", bgImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800" },
    { icon: Mountain, title: "Adventure", path: "/category/adventure", bgImage: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <div className="sticky top-0 md:top-16 z-40 bg-background border-b shadow-sm">
        <div className="container px-4 py-4">
          {/* Search bar border-radius set to zero */}
          <SearchBarWithSuggestions 
            value={searchQuery} 
            onChange={setSearchQuery} 
            onSubmit={() => fetchAllData(searchQuery)}
            className="rounded-none" // Tailwind class to remove border-radius
          />
        </div>
      </div>
      
      {/* Remove padding from main container */}
      <main className="container px-0 md:py-8">
        
        {/* Remove margin/gap between categories and slideshow section */}
        <section className="flex flex-col lg:flex-row gap-0">
          
          {/* Categories Container: Width 1/3 (Adjusted from 1/3 to 2/5 for bigger look), order 1, height set to match slideshow via 'h-full' and 'flex-grow' context */}
          <div 
            className="w-full lg:w-2/5 order-2 lg:order-1 flex flex-col" 
            style={{ minHeight: '300px' }} // Ensures minimum height on mobile
          >
            {/* The grid must fill the container's height (h-full) and use gap-4 for separation */}
            <div className="grid grid-cols-2 gap-4 lg:h-full lg:flex-grow">
              {categories.map((cat) => (
                <div
                  key={cat.title}
                  onClick={() => navigate(cat.path)}
                  // Use aspect-square on small screens, and let lg:h-full manage height on large screens
                  className="relative aspect-square cursor-pointer overflow-hidden group rounded-none" // border-radius set to zero
                  style={{ backgroundImage: `url(${cat.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                >
                  {/* Category Content Overlay */}
                  <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-all flex flex-col items-center justify-center p-4">
                    <cat.icon className="h-6 w-6 md:h-12 md:w-12 text-white mb-1 md:mb-2" />
                    <h3 className="font-bold text-white text-xs md:text-lg">{cat.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Slideshow Container: Width 2/3 (Adjusted from 2/3 to 3/5), order 2 */}
          <div className="w-full lg:w-3/5 order-1 lg:order-2">
            <ImageSlideshow />
          </div>
        </section>
        
        {/* Listings Section (Add back horizontal padding for content) */}
        <div className="px-4">
          <hr className="border-t border-gray-200 my-8" />
          <section>
            <div className="bg-blue-950 text-white w-full py-3 mb-6 px-4">
              <h2 className="font-bold text-xl lg:text-2xl">Popular Picks and Recent Finds</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <div key={i} className="shadow-lg">
                    <div className="aspect-[4/3] bg-muted animate-pulse" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    </div>
                  </div>
                ))
              ) : (
                listings.map((item) => (
                  <ListingCard
                    key={item.id}
                    id={item.id}
                    type={item.type}
                    name={item.name}
                    imageUrl={item.image_url}
                    location={item.location}
                    country={item.country}
                    price={item.price || item.entry_fee || 0}
                    date={item.date}
                    onSave={handleSave}
                    isSaved={savedItems.has(item.id)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};
export default Index;