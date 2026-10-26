/*
 * cities.js — searchable places for World Meetings.
 *
 * A curated list of major cities (so you can search "Munich", "Bangalore",
 * "San Francisco" or a country name), merged with every IANA zone the
 * browser knows about. Only the IANA zone id matters for the time math.
 */
(function (root) {
  'use strict';

  // City | Country | IANA zone | optional search aliases
  const CURATED = `
New York|United States|America/New_York|NYC
Los Angeles|United States|America/Los_Angeles|LA
Chicago|United States|America/Chicago
Denver|United States|America/Denver
Phoenix|United States (Arizona)|America/Phoenix
Tucson|United States (Arizona)|America/Phoenix
San Francisco|United States|America/Los_Angeles|SF Bay Area Silicon Valley
San Jose|United States|America/Los_Angeles
San Diego|United States|America/Los_Angeles
Pasadena|United States|America/Los_Angeles
Sacramento|United States|America/Los_Angeles
Seattle|United States|America/Los_Angeles
Portland|United States|America/Los_Angeles
Las Vegas|United States|America/Los_Angeles
Boston|United States|America/New_York
Washington, D.C.|United States|America/New_York|DC
Baltimore|United States|America/New_York
Philadelphia|United States|America/New_York
Princeton|United States|America/New_York
Pittsburgh|United States|America/New_York
Atlanta|United States|America/New_York
Miami|United States|America/New_York
Orlando|United States|America/New_York
Charlotte|United States|America/New_York
Raleigh|United States|America/New_York
Cleveland|United States|America/New_York
Columbus|United States|America/New_York
Ithaca|United States|America/New_York
Detroit|United States|America/Detroit
Ann Arbor|United States|America/Detroit
Indianapolis|United States|America/Indiana/Indianapolis
Houston|United States|America/Chicago
Dallas|United States|America/Chicago
Austin|United States|America/Chicago
San Antonio|United States|America/Chicago
Minneapolis|United States|America/Chicago
Madison|United States|America/Chicago
St. Louis|United States|America/Chicago
Kansas City|United States|America/Chicago
Nashville|United States|America/Chicago
New Orleans|United States|America/Chicago
Salt Lake City|United States|America/Denver
Boulder|United States|America/Denver
Albuquerque|United States|America/Denver
Anchorage|United States (Alaska)|America/Anchorage
Honolulu|United States (Hawaii)|Pacific/Honolulu
Hilo|United States (Hawaii)|Pacific/Honolulu
San Juan|Puerto Rico|America/Puerto_Rico
Toronto|Canada|America/Toronto
Montreal|Canada|America/Toronto
Ottawa|Canada|America/Toronto
Quebec City|Canada|America/Toronto
Vancouver|Canada|America/Vancouver
Victoria|Canada|America/Vancouver
Calgary|Canada|America/Edmonton
Edmonton|Canada|America/Edmonton
Regina|Canada|America/Regina
Winnipeg|Canada|America/Winnipeg
Halifax|Canada|America/Halifax
St. John's|Canada (Newfoundland)|America/St_Johns
Mexico City|Mexico|America/Mexico_City
Guadalajara|Mexico|America/Mexico_City
Monterrey|Mexico|America/Monterrey
Tijuana|Mexico|America/Tijuana
Cancún|Mexico|America/Cancun
Guatemala City|Guatemala|America/Guatemala
San José|Costa Rica|America/Costa_Rica
Panama City|Panama|America/Panama
Havana|Cuba|America/Havana
Kingston|Jamaica|America/Jamaica
Santo Domingo|Dominican Republic|America/Santo_Domingo
Bogotá|Colombia|America/Bogota
Medellín|Colombia|America/Bogota
Caracas|Venezuela|America/Caracas
Quito|Ecuador|America/Guayaquil
Lima|Peru|America/Lima
La Paz|Bolivia|America/La_Paz
Santiago|Chile|America/Santiago
La Serena|Chile|America/Santiago
Buenos Aires|Argentina|America/Argentina/Buenos_Aires
Córdoba|Argentina|America/Argentina/Cordoba
Montevideo|Uruguay|America/Montevideo
Asunción|Paraguay|America/Asuncion
São Paulo|Brazil|America/Sao_Paulo
Rio de Janeiro|Brazil|America/Sao_Paulo
Brasília|Brazil|America/Sao_Paulo
Manaus|Brazil|America/Manaus
Reykjavík|Iceland|Atlantic/Reykjavik
London|United Kingdom|Europe/London
Edinburgh|United Kingdom|Europe/London
Manchester|United Kingdom|Europe/London
Cambridge|United Kingdom|Europe/London
Oxford|United Kingdom|Europe/London
Dublin|Ireland|Europe/Dublin
Lisbon|Portugal|Europe/Lisbon|Lisboa
Madrid|Spain|Europe/Madrid
Barcelona|Spain|Europe/Madrid
Canary Islands|Spain|Atlantic/Canary
Paris|France|Europe/Paris
Lyon|France|Europe/Paris
Brussels|Belgium|Europe/Brussels|Bruxelles Brussel
Amsterdam|Netherlands|Europe/Amsterdam
Leiden|Netherlands|Europe/Amsterdam
Luxembourg|Luxembourg|Europe/Luxembourg
Berlin|Germany|Europe/Berlin
Munich|Germany|Europe/Berlin|München
Garching|Germany|Europe/Berlin
Heidelberg|Germany|Europe/Berlin
Frankfurt|Germany|Europe/Berlin
Hamburg|Germany|Europe/Berlin
Cologne|Germany|Europe/Berlin|Köln
Zurich|Switzerland|Europe/Zurich|Zürich
Geneva|Switzerland|Europe/Zurich|Genève Genf
Bern|Switzerland|Europe/Zurich
Vienna|Austria|Europe/Vienna|Wien
Rome|Italy|Europe/Rome|Roma
Milan|Italy|Europe/Rome
Copenhagen|Denmark|Europe/Copenhagen|København
Oslo|Norway|Europe/Oslo
Stockholm|Sweden|Europe/Stockholm
Helsinki|Finland|Europe/Helsinki
Tallinn|Estonia|Europe/Tallinn
Riga|Latvia|Europe/Riga
Vilnius|Lithuania|Europe/Vilnius
Warsaw|Poland|Europe/Warsaw|Warszawa
Kraków|Poland|Europe/Warsaw
Prague|Czechia|Europe/Prague|Praha
Budapest|Hungary|Europe/Budapest
Bratislava|Slovakia|Europe/Bratislava
Ljubljana|Slovenia|Europe/Ljubljana
Zagreb|Croatia|Europe/Zagreb
Belgrade|Serbia|Europe/Belgrade
Bucharest|Romania|Europe/Bucharest
Sofia|Bulgaria|Europe/Sofia
Athens|Greece|Europe/Athens|Athina
Istanbul|Turkey|Europe/Istanbul
Ankara|Turkey|Europe/Istanbul
Kyiv|Ukraine|Europe/Kyiv|Kiev
Minsk|Belarus|Europe/Minsk
Moscow|Russia|Europe/Moscow
Saint Petersburg|Russia|Europe/Moscow
Novosibirsk|Russia|Asia/Novosibirsk
Vladivostok|Russia|Asia/Vladivostok
Cairo|Egypt|Africa/Cairo
Casablanca|Morocco|Africa/Casablanca
Algiers|Algeria|Africa/Algiers
Tunis|Tunisia|Africa/Tunis
Lagos|Nigeria|Africa/Lagos
Accra|Ghana|Africa/Accra
Dakar|Senegal|Africa/Dakar
Kinshasa|DR Congo|Africa/Kinshasa
Nairobi|Kenya|Africa/Nairobi
Addis Ababa|Ethiopia|Africa/Addis_Ababa
Kampala|Uganda|Africa/Kampala
Kigali|Rwanda|Africa/Kigali
Dar es Salaam|Tanzania|Africa/Dar_es_Salaam
Johannesburg|South Africa|Africa/Johannesburg
Cape Town|South Africa|Africa/Johannesburg
Windhoek|Namibia|Africa/Windhoek
Jerusalem|Israel|Asia/Jerusalem
Tel Aviv|Israel|Asia/Jerusalem
Beirut|Lebanon|Asia/Beirut
Amman|Jordan|Asia/Amman
Baghdad|Iraq|Asia/Baghdad
Riyadh|Saudi Arabia|Asia/Riyadh
Kuwait City|Kuwait|Asia/Kuwait
Doha|Qatar|Asia/Qatar
Dubai|United Arab Emirates|Asia/Dubai
Abu Dhabi|United Arab Emirates|Asia/Dubai
Tehran|Iran|Asia/Tehran
Kabul|Afghanistan|Asia/Kabul
Karachi|Pakistan|Asia/Karachi
Lahore|Pakistan|Asia/Karachi
Islamabad|Pakistan|Asia/Karachi
Tashkent|Uzbekistan|Asia/Tashkent
Almaty|Kazakhstan|Asia/Almaty
Mumbai|India|Asia/Kolkata|Bombay
New Delhi|India|Asia/Kolkata
Bangalore|India|Asia/Kolkata|Bengaluru
Chennai|India|Asia/Kolkata|Madras
Hyderabad|India|Asia/Kolkata
Pune|India|Asia/Kolkata
Kolkata|India|Asia/Kolkata|Calcutta
Colombo|Sri Lanka|Asia/Colombo
Kathmandu|Nepal|Asia/Kathmandu
Dhaka|Bangladesh|Asia/Dhaka
Yangon|Myanmar|Asia/Yangon
Bangkok|Thailand|Asia/Bangkok
Hanoi|Vietnam|Asia/Ho_Chi_Minh|Ha Noi
Ho Chi Minh City|Vietnam|Asia/Ho_Chi_Minh|Saigon
Jakarta|Indonesia|Asia/Jakarta
Bali|Indonesia|Asia/Makassar
Singapore|Singapore|Asia/Singapore
Kuala Lumpur|Malaysia|Asia/Kuala_Lumpur
Manila|Philippines|Asia/Manila
Hong Kong|China|Asia/Hong_Kong
Taipei|Taiwan|Asia/Taipei|Taiwan
Beijing|China|Asia/Shanghai|Peking
Shanghai|China|Asia/Shanghai
Shenzhen|China|Asia/Shanghai
Guangzhou|China|Asia/Shanghai
Chengdu|China|Asia/Shanghai
Ulaanbaatar|Mongolia|Asia/Ulaanbaatar
Seoul|South Korea|Asia/Seoul|Korea
Tokyo|Japan|Asia/Tokyo
Osaka|Japan|Asia/Tokyo
Kyoto|Japan|Asia/Tokyo
Perth|Australia|Australia/Perth
Darwin|Australia|Australia/Darwin
Adelaide|Australia|Australia/Adelaide
Brisbane|Australia|Australia/Brisbane
Sydney|Australia|Australia/Sydney
Canberra|Australia|Australia/Sydney
Melbourne|Australia|Australia/Melbourne
Hobart|Australia|Australia/Hobart
Auckland|New Zealand|Pacific/Auckland
Wellington|New Zealand|Pacific/Auckland
Suva|Fiji|Pacific/Fiji
Guam|Guam|Pacific/Guam
UTC|Coordinated Universal Time|UTC
`;

  function normalize(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /** Build the full list: [{city, country, tz, search}] */
  function buildPlaces(isValidZone) {
    const places = [];
    const seen = new Set();
    for (const line of CURATED.split('\n')) {
      if (!line.trim()) continue;
      const [city, country, tz, aliases] = line.split('|');
      if (isValidZone && !isValidZone(tz)) continue;
      places.push({ city, country, tz, aliases: aliases || '', curated: true });
      seen.add(normalize(city) + '|' + tz);
    }
    let all = [];
    try { all = Intl.supportedValuesOf('timeZone'); } catch (e) { /* older browsers */ }
    for (const tz of all) {
      const segs = tz.split('/');
      if (segs.length < 2) continue;
      const city = segs[segs.length - 1].replace(/_/g, ' ');
      if (seen.has(normalize(city) + '|' + tz)) continue;
      const region = segs.slice(0, -1).join(' / ').replace(/_/g, ' ');
      places.push({ city, country: region, tz });
    }
    for (const p of places) {
      p.search = normalize(p.city + ' ' + (p.aliases || '') + ' ' + p.country + ' ' + p.tz.replace(/[_/]/g, ' '));
      p.cityN = normalize(p.city);
    }
    return places;
  }

  /** Rank places for a query; returns at most `limit` results. */
  function searchPlaces(places, query, limit) {
    const q = normalize(query.trim());
    if (!q) return [];
    const tokens = q.split(/\s+/);
    const scored = [];
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      if (!tokens.every((t) => p.search.includes(t))) continue;
      let s = 3;
      if (p.cityN === q || (p.aliases && normalize(p.aliases) === q)) s = 0;
      else if (p.cityN.startsWith(q)) s = 1;
      else if (p.cityN.split(/[\s(]+/).some((w) => w.startsWith(tokens[0]))) s = 2;
      else if (p.aliases && normalize(p.aliases).split(/\s+/).some((w) => w.startsWith(tokens[0]))) s = 2;
      scored.push([s, p.curated ? 0 : 1, i, p]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    return scored.slice(0, limit || 8).map((x) => x[3]);
  }

  /** Nice label for a zone id (used for the user's own zone). */
  function placeForZone(places, tz) {
    const segs = tz.split('/');
    const ianaCity = normalize(segs[segs.length - 1].replace(/_/g, ' '));
    const curated = places.find((p) => p.curated && p.tz === tz && p.cityN === ianaCity) ||
      places.find((p) => p.curated && p.tz === tz);
    if (curated) return curated;
    return { city: segs[segs.length - 1].replace(/_/g, ' '), country: segs.slice(0, -1).join(' / ').replace(/_/g, ' '), tz };
  }

  const api = { buildPlaces, searchPlaces, placeForZone, normalize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WMCities = api;
})(typeof window !== 'undefined' ? window : globalThis);
