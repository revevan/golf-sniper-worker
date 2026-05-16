export const COURSES = [
  // Long Beach
  { name: 'El Dorado Park', region: 'Long Beach', city: 'Long Beach', holes: [18], api: 'teeitup', alias: 'el-dorado-park-golf-course' },
  { name: 'Heartwell Golf Course', region: 'Long Beach', city: 'Long Beach', holes: [18], api: 'teeitup', alias: 'heartwell-golf-course' },
  // Tee times only available through the multi-course American Golf portal, not the individual subdomain
  { name: 'Recreation Park (18)', region: 'Long Beach', city: 'Long Beach', holes: [18], api: 'teeitup', alias: 'recreation-park-golf-course-18', teeItUpAlias: 'american-golf-long-beach', teeItUpOrigin: 'https://american-golf-long-beach-public.book.teeitup.com', teeItUpCourseId: '54f14bbc0c8ad60378b01579' },
  { name: 'Recreation Park (9)', region: 'Long Beach', city: 'Long Beach', holes: [9], api: 'teeitup', alias: 'recreation-park-golf-course-9' },
  { name: 'Skylinks at Long Beach', region: 'Long Beach', city: 'Long Beach', holes: [18], api: 'teeitup', alias: 'skylinks-golf-course' },

  // LA County Parks
  { name: 'Alondra Park', region: 'LA County Parks', city: 'Lawndale', holes: [18], api: 'teeitup', alias: 'alondra-park-golf-course' },
  { name: 'Chester Washington', region: 'LA County Parks', city: 'Los Angeles', holes: [18], api: 'teeitup', alias: 'chester-washington-golf-course' },
  { name: 'Diamond Bar', region: 'LA County Parks', city: 'Diamond Bar', holes: [18], api: 'teeitup', alias: 'diamond-bar-golf-course' },
  { name: 'Don Knabe Golf Center', region: 'LA County Parks', city: 'Norwalk', holes: [9], api: 'teeitup', alias: 'don-knabe-golf-center-junior-academy-formerly-norwalk' },
  { name: 'Industry Hills – Eisenhower', region: 'LA County Parks', city: 'City of Industry', holes: [18], api: 'teeitup', alias: 'industry-hills-golf-club-ike-course' },
  { name: 'Industry Hills – Zaharias', region: 'LA County Parks', city: 'City of Industry', holes: [18], api: 'teeitup', alias: 'industry-hills-golf-club-babe-course' },
  { name: 'Knollwood', region: 'LA County Parks', city: 'Granada Hills', holes: [18], api: 'teeitup', alias: 'knollwood-golf-course' },
  { name: 'La Mirada Golf Club', region: 'LA County Parks', city: 'La Mirada', holes: [18], api: 'teeitup', alias: 'la-mirada-golf-club' },
  { name: 'Lakewood Country Club', region: 'LA County Parks', city: 'Lakewood', holes: [18], api: 'teeitup', alias: 'lakewood-country-club' },
  { name: 'Los Verdes', region: 'LA County Parks', city: 'Rancho Palos Verdes', holes: [18], api: 'teeitup', alias: 'los-verdes-golf-course' },
  { name: 'Maggie Hathaway', region: 'LA County Parks', city: 'Los Angeles', holes: [9], api: 'teeitup', alias: 'maggie-hathaway-golf-course' },
  { name: 'Marshall Canyon', region: 'LA County Parks', city: 'La Verne', holes: [18], api: 'teeitup', alias: 'marshall-canyon-golf-course' },
  { name: 'Mountain Meadows', region: 'LA County Parks', city: 'Pomona', holes: [18], api: 'teeitup', alias: 'mountain-meadows-golf-course' },
  { name: 'Whittier Narrows', region: 'LA County Parks', city: 'Rosemead', holes: [18], api: 'teeitup', alias: 'whittier-narrows-golf-course' },

  // City of LA
  { name: 'Balboa', region: 'City of LA', city: 'Encino', holes: [18], api: 'golfnow', facilityId: 12197 },
  { name: 'Encino', region: 'City of LA', city: 'Encino', holes: [18], api: 'golfnow', facilityId: 12200 },
  { name: 'Hansen Dam', region: 'City of LA', city: 'Lake View Terrace', holes: [18], api: 'golfnow', facilityId: 12201 },
  { name: 'Harbor Park', region: 'City of LA', city: 'Wilmington', holes: [18], api: 'golfnow', facilityId: 12218 },
  { name: 'Harding (Griffith Park)', region: 'City of LA', city: 'Los Angeles', holes: [18], api: 'golfnow', facilityId: 12202 },
  { name: 'Los Feliz Municipal', region: 'City of LA', city: 'Los Angeles', holes: [9], api: 'golfnow', facilityId: 16836 },
  { name: 'Penmar', region: 'City of LA', city: 'Venice', holes: [9], api: 'golfnow', facilityId: 12219 },
  { name: 'Rancho Park', region: 'City of LA', city: 'Los Angeles', holes: [18], api: 'golfnow', facilityId: 12203 },
  { name: 'Rancho Park Par-3', region: 'City of LA', city: 'Los Angeles', holes: [9], api: 'golfnow', facilityId: 17155 },
  { name: 'Roosevelt', region: 'City of LA', city: 'Los Angeles', holes: [9], api: 'golfnow', facilityId: 12220 },
  { name: 'Wilson (Griffith Park)', region: 'City of LA', city: 'Los Angeles', holes: [18], api: 'golfnow', facilityId: 12204 },
  { name: 'Woodley Lakes', region: 'City of LA', city: 'Van Nuys', holes: [18], api: 'golfnow', facilityId: 12205 },

  // Ventura County
  { name: 'Rustic Canyon', region: 'Ventura County', city: 'Moorpark', holes: [18], api: 'foreup', facilityId: '21903', scheduleId: '9285' },

  // Orange County
  { name: 'Anaheim Hills Golf Course', region: 'Orange County', city: 'Anaheim', holes: [18], api: 'golfnow', facilityId: 1236 },
  { name: 'Costa Mesa CC (Los Lagos)', region: 'Orange County', city: 'Costa Mesa', holes: [18], api: 'golfnow', facilityId: 12885 },
  { name: 'Costa Mesa CC (Mesa Linda)', region: 'Orange County', city: 'Costa Mesa', holes: [18], api: 'golfnow', facilityId: 12886 },
  { name: 'Coyote Hills Golf Course', region: 'Orange County', city: 'Fullerton', holes: [18], api: 'teeitup', alias: 'coyote-hills-golf-course' },
  { name: 'Dad Miller Golf Course', region: 'Orange County', city: 'Anaheim', holes: [18], api: 'golfnow', facilityId: 5240 },
  { name: 'Fullerton Golf Course', region: 'Orange County', city: 'Fullerton', holes: [18], api: 'teeitup', alias: 'fullerton-golf-course' },
  { name: 'Lake Forest Golf & Practice Center', region: 'Orange County', city: 'Lake Forest', holes: [9], api: 'teeitup', alias: 'lake-forest-golf-and-practice-center' },
  { name: 'Mile Square Golf Course', region: 'Orange County', city: 'Fountain Valley', holes: [18], api: 'foreup', facilityId: '20096', scheduleId: '3760' },
  { name: 'Rancho San Joaquin', region: 'Orange County', city: 'Irvine', holes: [18], api: 'teeitup', alias: 'rancho-san-joaquin-golf-club' },
  { name: 'River View Golf Course', region: 'Orange County', city: 'Santa Ana', holes: [18], api: 'teeitup', alias: 'river-view-golf-club' },
  { name: 'San Clemente Municipal Golf Course', region: 'Orange County', city: 'San Clemente', holes: [18], api: 'foreup', facilityId: '18754', scheduleId: '413' },

  // Atlanta
  { name: 'Browns Mill Golf Course', region: 'Atlanta', city: 'Atlanta', holes: [18], api: 'teeitup', alias: 'browns-mill-golf-course' },
  { name: 'Chastain Park Golf Course', region: 'Atlanta', city: 'Atlanta', holes: [18], api: 'teeitup', alias: 'chastain-park' },
  { name: "Alfred 'Tup' Holmes Golf Course", region: 'Atlanta', city: 'Atlanta', holes: [18], api: 'teeitup', alias: 'alfred-tup-holmes' },
];
