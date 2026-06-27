// All 47 counties of Kenya — ordered by general tourism popularity
// (capital city, major safari parks, and coastal beach destinations first,
// down to the least-visited counties).
export const KENYA_COUNTIES = [
  // Capital
  "Nairobi",
  // Coastal beach destinations
  "Mombasa", "Kwale", "Kilifi", "Lamu",
  // Premier safari / national park counties
  "Narok", "Kajiado", "Nakuru", "Taita-Taveta", "Laikipia",
  "Nyeri", "Isiolo", "Samburu", "Meru",
  // Lakes, tea country & well-known secondary destinations
  "Kisumu", "Kericho", "Nyandarua", "Uasin Gishu", "Baringo",
  // Mountain / forest destinations
  "Trans-Nzoia", "Kakamega", "Bungoma",
  // Central / commuter counties with moderate tourism
  "Kiambu", "Murang'a", "Kirinyaga", "Embu", "Tharaka-Nithi",
  // Eastern / lower-traffic counties
  "Machakos", "Makueni", "Kitui", "Marsabit", "Turkana",
  // Western / Nyanza counties
  "Homa Bay", "Migori", "Kisii", "Nyamira", "Bomet",
  "Nandi", "Elgeyo-Marakwet", "West Pokot", "Vihiga", "Siaya", "Busia",
  // North Eastern / least-visited counties
  "Garissa", "Tana River", "Wajir", "Mandera"
];

// County images stored locally
export const COUNTY_IMAGES: Record<string, string> = {
  "Baringo": "/images/counties/baringo.png",
  "Bomet": "/images/counties/bomet.png",
  "Bungoma": "/images/counties/bungoma.jpg",
  "Busia": "/images/counties/busia.jpg",
  "Elgeyo-Marakwet": "/images/counties/elgeyo-marakwet.jpg",
  "Embu": "/images/counties/embu.jpg",
  "Garissa": "/images/counties/garissa.jpg",
  "Homa Bay": "/images/counties/homa-bay.jpg",
  "Isiolo": "/images/counties/isiolo.jpg",
  "Kajiado": "/images/counties/kajiado.jpg",
  "Kakamega": "/images/counties/kakamega.jpg",
  "Kericho": "/images/counties/kericho.jpg",
  "Kiambu": "/images/counties/kiambu.jpg",
  "Kilifi": "/images/counties/kilifi.jpg",
  "Kirinyaga": "/images/counties/kirinyaga.jpg",
  "Kisii": "/images/counties/kisii.jpg",
  "Kisumu": "/images/counties/kisumu.jpg",
  "Kitui": "/images/counties/kitui.jpg",
  "Kwale": "/images/counties/kwale.jpg",
  "Laikipia": "/images/counties/laikipia.jpg",
  "Lamu": "/images/counties/lamu.jpg",
  "Machakos": "/images/counties/machakos.png",
  "Makueni": "/images/counties/makueni.png",
  "Mandera": "/images/counties/mandera.jpg",
  "Marsabit": "/images/counties/marsabit.jpg",
  "Meru": "/images/counties/meru.jpg",
  "Migori": "/images/counties/migori.jpg",
  "Mombasa": "/images/counties/mombasa.jpg",
  "Murang'a": "/images/counties/muranga.jpg",
  "Nairobi": "/images/counties/nairobi.jpg",
  "Nakuru": "/images/counties/nakuru.jpg",
  "Nandi": "/images/counties/nandi.jpg",
  "Narok": "/images/counties/narok.jpg",
  "Nyamira": "/images/counties/nyamira.jpg",
  "Nyandarua": "/images/counties/nyandarua.jpg",
  "Nyeri": "/images/counties/nyeri.jpg",
  "Samburu": "/images/counties/samburu.jpg",
  "Siaya": "/images/counties/siaya.jpg",
  "Taita-Taveta": "/images/counties/taita-taveta.jpg",
  "Tana River": "/images/counties/tana-river.jpg",
  "Tharaka-Nithi": "/images/counties/tharaka-nithi.jpg",
  "Trans-Nzoia": "/images/counties/trans-nzoia.jpg",
  "Turkana": "/images/counties/turkana.jpg",
  "Uasin Gishu": "/images/counties/uasin-gishu.jpg",
  "Vihiga": "/images/counties/vihiga.jpg",
  "Wajir": "/images/counties/wajir.jpg",
  "West Pokot": "/images/counties/west-pokot.jpg",
};

// All 47 counties featured on the index page, in popularity order
export const FEATURED_COUNTIES = [...KENYA_COUNTIES];