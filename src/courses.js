export const COURSES = [
  // Long Beach
  { name: 'El Dorado Park', city: 'Long Beach', holes: [18], api: 'teeitup', alias: 'el-dorado-park-golf-course' },
  { name: 'Heartwell Golf Course', city: 'Long Beach', holes: [18], api: 'teeitup', alias: 'heartwell-golf-course' },
  // Tee times only available through the multi-course American Golf portal, not the individual subdomain
  { name: 'Recreation Park (18)', city: 'Long Beach', holes: [18], api: 'teeitup', alias: 'recreation-park-golf-course-18', teeItUpAlias: 'american-golf-long-beach', teeItUpOrigin: 'https://american-golf-long-beach-public.book.teeitup.com', teeItUpCourseId: '54f14bbc0c8ad60378b01579' },
  { name: 'Recreation Park (9)', city: 'Long Beach', holes: [9], api: 'teeitup', alias: 'recreation-park-golf-course-9' },
  { name: 'Skylinks at Long Beach', city: 'Long Beach', holes: [18], api: 'teeitup', alias: 'skylinks-golf-course' },

  // LA County DPR
  { name: 'Alondra Park', city: 'Lawndale', holes: [18], api: 'teeitup', alias: 'alondra-park-golf-course' },
  { name: 'Chester Washington', city: 'Los Angeles', holes: [18], api: 'teeitup', alias: 'chester-washington-golf-course' },
  { name: 'Diamond Bar', city: 'Diamond Bar', holes: [18], api: 'teeitup', alias: 'diamond-bar-golf-course' },
  { name: 'Don Knabe Golf Center', city: 'Norwalk', holes: [9], api: 'teeitup', alias: 'don-knabe-golf-center-junior-academy-formerly-norwalk' },
  { name: 'Knollwood', city: 'Granada Hills', holes: [18], api: 'teeitup', alias: 'knollwood-golf-course' },
  { name: 'La Mirada Golf Club', city: 'La Mirada', holes: [18], api: 'teeitup', alias: 'la-mirada-golf-club' },
  { name: 'Lakewood Country Club', city: 'Lakewood', holes: [18], api: 'teeitup', alias: 'lakewood-country-club' },
  { name: 'Los Verdes', city: 'Rancho Palos Verdes', holes: [18], api: 'teeitup', alias: 'los-verdes-golf-course' },
  { name: 'Maggie Hathaway', city: 'Los Angeles', holes: [9], api: 'teeitup', alias: 'maggie-hathaway-golf-course' },
  { name: 'Marshall Canyon', city: 'La Verne', holes: [18], api: 'teeitup', alias: 'marshall-canyon-golf-course' },
  { name: 'Mountain Meadows', city: 'Pomona', holes: [18], api: 'teeitup', alias: 'mountain-meadows-golf-course' },
  { name: 'Whittier Narrows', city: 'Rosemead', holes: [18], api: 'teeitup', alias: 'whittier-narrows-golf-course' },

  // Industry Hills
  { name: 'Industry Hills – Eisenhower', city: 'City of Industry', holes: [18], api: 'teeitup', alias: 'industry-hills-golf-club-ike-course' },
  { name: 'Industry Hills – Zaharias', city: 'City of Industry', holes: [18], api: 'teeitup', alias: 'industry-hills-golf-club-babe-course' },

  // ForeUp
  { name: 'Rustic Canyon', city: 'Moorpark', holes: [18], api: 'foreup', facilityId: '21903', scheduleId: '9285' },

  // City of LA (GolfNow)
  { name: 'Harding (Griffith Park)', city: 'Los Angeles', holes: [18], api: 'golfnow', facilityId: 12202 },
  { name: 'Wilson (Griffith Park)', city: 'Los Angeles', holes: [18], api: 'golfnow', facilityId: 12204 },
  { name: 'Rancho Park', city: 'Los Angeles', holes: [18], api: 'golfnow', facilityId: 12203 },
  { name: 'Rancho Park Par-3', city: 'Los Angeles', holes: [9], api: 'golfnow', facilityId: 17155 },
  { name: 'Encino', city: 'Encino', holes: [18], api: 'golfnow', facilityId: 12200 },
  { name: 'Balboa', city: 'Encino', holes: [18], api: 'golfnow', facilityId: 12197 },
  { name: 'Woodley Lakes', city: 'Van Nuys', holes: [18], api: 'golfnow', facilityId: 12205 },
  { name: 'Hansen Dam', city: 'Lake View Terrace', holes: [18], api: 'golfnow', facilityId: 12201 },
  { name: 'Roosevelt', city: 'Los Angeles', holes: [9], api: 'golfnow', facilityId: 12220 },
  { name: 'Penmar', city: 'Venice', holes: [9], api: 'golfnow', facilityId: 12219 },
  { name: 'Harbor Park', city: 'Wilmington', holes: [18], api: 'golfnow', facilityId: 12218 },
  { name: 'Los Feliz Municipal', city: 'Los Angeles', holes: [9], api: 'golfnow', facilityId: 16836 },
];
