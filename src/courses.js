export const COURSES = [
  // Long Beach
  { name: 'El Dorado Park', region: 'Long Beach', city: 'Long Beach', holes: [18, 9], api: 'teeitup', alias: 'el-dorado-park-golf-course' },
  { name: 'Heartwell Golf Course', region: 'Long Beach', city: 'Long Beach', holes: [18, 9], api: 'teeitup', alias: 'heartwell-golf-course' },
  // Tee times only available through the multi-course American Golf portal, not the individual subdomain
  { name: 'Recreation Park (18)', region: 'Long Beach', city: 'Long Beach', holes: [18, 9], api: 'teeitup', alias: 'recreation-park-golf-course-18', teeItUpAlias: 'american-golf-long-beach', teeItUpOrigin: 'https://american-golf-long-beach-public.book.teeitup.com', teeItUpCourseId: '54f14bbc0c8ad60378b01579' },
  { name: 'Recreation Park (9)', region: 'Long Beach', city: 'Long Beach', holes: [9], api: 'teeitup', alias: 'recreation-park-golf-course-9' },
  { name: 'Skylinks at Long Beach', region: 'Long Beach', city: 'Long Beach', holes: [18, 9], api: 'teeitup', alias: 'skylinks-golf-course' },

  // LA City
  { name: 'Balboa', region: 'LA City', city: 'Encino', holes: [18], api: 'golfnow', facilityId: 12197 },
  { name: 'Encino', region: 'LA City', city: 'Encino', holes: [18], api: 'golfnow', facilityId: 12200 },
  { name: 'Hansen Dam', region: 'LA City', city: 'Lake View Terrace', holes: [18], api: 'golfnow', facilityId: 12201 },
  { name: 'Harbor Park', region: 'LA City', city: 'Wilmington', holes: [18], api: 'golfnow', facilityId: 12218 },
  { name: 'Harding (Griffith Park)', region: 'LA City', city: 'Los Angeles', holes: [18], api: 'golfnow', facilityId: 12202 },
  { name: 'Los Feliz Municipal', region: 'LA City', city: 'Los Angeles', holes: [9], api: 'golfnow', facilityId: 16836 },
  { name: 'Penmar', region: 'LA City', city: 'Venice', holes: [9], api: 'golfnow', facilityId: 12219 },
  { name: 'Rancho Park', region: 'LA City', city: 'Los Angeles', holes: [18], api: 'golfnow', facilityId: 12203 },
  { name: 'Rancho Park Par-3', region: 'LA City', city: 'Los Angeles', holes: [9], api: 'golfnow', facilityId: 17155 },
  { name: 'Roosevelt', region: 'LA City', city: 'Los Angeles', holes: [9], api: 'golfnow', facilityId: 12220 },
  { name: 'Scholl Canyon Golf Club', region: 'LA City', city: 'Glendale', holes: [18], api: 'golfnow', facilityId: 76 },
  { name: 'Westchester Golf Course', region: 'LA City', city: 'Los Angeles', holes: [18], api: 'golfnow', facilityId: 941 },
  { name: 'Wilson (Griffith Park)', region: 'LA City', city: 'Los Angeles', holes: [18], api: 'golfnow', facilityId: 12204 },
  { name: 'Woodley Lakes', region: 'LA City', city: 'Van Nuys', holes: [18], api: 'golfnow', facilityId: 12205 },

  // LA County
  { name: 'Alondra Park', region: 'LA County', city: 'Lawndale', holes: [18], api: 'teeitup', alias: 'alondra-park-golf-course' },
  { name: 'Angeles National Golf Club', region: 'LA County', city: 'Sunland', holes: [18], api: 'golfnow', facilityId: 880 },
  { name: 'Chester Washington', region: 'LA County', city: 'Los Angeles', holes: [18], api: 'teeitup', alias: 'chester-washington-golf-course' },
  { name: 'DeBell Golf Club', region: 'LA County', city: 'Burbank', holes: [18], api: 'golfnow', facilityId: 4498 },
  { name: 'DeBell Par-3 Course', region: 'LA County', city: 'Burbank', holes: [9], api: 'golfnow', facilityId: 9448 },
  { name: 'Diamond Bar', region: 'LA County', city: 'Diamond Bar', holes: [18], api: 'teeitup', alias: 'diamond-bar-golf-course' },
  { name: 'Don Knabe Golf Center', region: 'LA County', city: 'Norwalk', holes: [9], api: 'teeitup', alias: 'don-knabe-golf-center-junior-academy-formerly-norwalk' },
  { name: 'El Cariso Golf Course', region: 'LA County', city: 'Sylmar', holes: [18], api: 'golfnow', facilityId: 13017 },
  { name: 'Industry Hills – Eisenhower', region: 'LA County', city: 'City of Industry', holes: [18], api: 'teeitup', alias: 'industry-hills-golf-club-ike-course' },
  { name: 'Industry Hills – Zaharias', region: 'LA County', city: 'City of Industry', holes: [18], api: 'teeitup', alias: 'industry-hills-golf-club-babe-course' },
  { name: 'Knollwood', region: 'LA County', city: 'Granada Hills', holes: [18], api: 'teeitup', alias: 'knollwood-golf-course' },
  { name: 'La Mirada Golf Club', region: 'LA County', city: 'La Mirada', holes: [18], api: 'teeitup', alias: 'la-mirada-golf-club' },
  { name: 'Lakewood Country Club', region: 'LA County', city: 'Lakewood', holes: [18], api: 'teeitup', alias: 'lakewood-country-club' },
  { name: 'Los Amigos Golf Course', region: 'LA County', city: 'Downey', holes: [18], api: 'teeitup', alias: 'los-amigos-golf-course' },
  { name: 'Los Verdes', region: 'LA County', city: 'Rancho Palos Verdes', holes: [18], api: 'teeitup', alias: 'los-verdes-golf-course' },
  { name: 'Maggie Hathaway', region: 'LA County', city: 'Los Angeles', holes: [9], api: 'teeitup', alias: 'maggie-hathaway-golf-course' },
  { name: 'Marshall Canyon', region: 'LA County', city: 'La Verne', holes: [18], api: 'teeitup', alias: 'marshall-canyon-golf-course' },
  { name: 'Mountain Meadows', region: 'LA County', city: 'Pomona', holes: [18], api: 'teeitup', alias: 'mountain-meadows-golf-course' },
  { name: 'Whittier Narrows', region: 'LA County', city: 'Rosemead', holes: [18], api: 'teeitup', alias: 'whittier-narrows-golf-course' },

  // Orange County
  { name: 'Anaheim Hills Golf Course', region: 'Orange County', city: 'Anaheim', holes: [18], api: 'golfnow', facilityId: 1236 },
  { name: 'Brea Creek Golf Course', region: 'Orange County', city: 'Brea', holes: [9], api: 'golfnow', facilityId: 3153 },
  { name: 'Costa Mesa CC (Los Lagos)', region: 'Orange County', city: 'Costa Mesa', holes: [18], api: 'golfnow', facilityId: 12885 },
  { name: 'Costa Mesa CC (Mesa Linda)', region: 'Orange County', city: 'Costa Mesa', holes: [18], api: 'golfnow', facilityId: 12886 },
  { name: 'Coyote Hills Golf Course', region: 'Orange County', city: 'Fullerton', holes: [18], api: 'teeitup', alias: 'coyote-hills-golf-course' },
  { name: 'Dad Miller Golf Course', region: 'Orange County', city: 'Anaheim', holes: [18], api: 'golfnow', facilityId: 5240 },
  { name: 'Fullerton Golf Course', region: 'Orange County', city: 'Fullerton', holes: [18], api: 'teeitup', alias: 'fullerton-golf-course' },
  { name: 'Lake Forest Golf & Practice Center', region: 'Orange County', city: 'Lake Forest', holes: [9], api: 'teeitup', alias: 'lake-forest-golf-and-practice-center' },
  { name: 'Laguna Woods Golf Course', region: 'Orange County', city: 'Laguna Woods', holes: [9], api: 'golfnow', facilityId: 14190 },
  { name: 'Mile Square Golf Course', region: 'Orange County', city: 'Fountain Valley', holes: [18], api: 'foreup', facilityId: '20096', scheduleId: '3760' },
  { name: 'Navy Golf Course (Destroyer)', region: 'Orange County', city: 'Cypress', holes: [18], api: 'golfnow', facilityId: 9834 },
  { name: 'Navy Golf Course (Cruiser)', region: 'Orange County', city: 'Cypress', holes: [9], api: 'golfnow', facilityId: 9835 },
  { name: 'Oso Creek Golf Course', region: 'Orange County', city: 'Mission Viejo', holes: [18], api: 'golfnow', facilityId: 940 },
  { name: 'Pelican Hill Golf Club (South)', region: 'Orange County', city: 'Newport Coast', holes: [18], api: 'golfnow', facilityId: 16071 },
  { name: 'Rancho San Joaquin', region: 'Orange County', city: 'Irvine', holes: [18], api: 'teeitup', alias: 'rancho-san-joaquin-golf-club' },
  { name: 'River View Golf Course', region: 'Orange County', city: 'Santa Ana', holes: [18], api: 'teeitup', alias: 'river-view-golf-club' },
  { name: 'San Clemente Municipal Golf Course', region: 'Orange County', city: 'San Clemente', holes: [18], api: 'foreup', facilityId: '18754', scheduleId: '413' },
  { name: 'Strawberry Farms Golf Club', region: 'Orange County', city: 'Irvine', holes: [18], api: 'golfnow', facilityId: 13545 },
  { name: 'Tustin Ranch Golf Club', region: 'Orange County', city: 'Tustin', holes: [18], api: 'teeitup', alias: 'tustin-ranch-golf-club' },

  // Ventura County
  { name: 'Camarillo Springs Golf Course', region: 'Ventura County', city: 'Camarillo', holes: [18], api: 'teeitup', alias: 'camarillo-springs-golf-course' },
  { name: 'Rustic Canyon', region: 'Ventura County', city: 'Moorpark', holes: [18], api: 'foreup', facilityId: '21903', scheduleId: '9285' },

  // Inland Empire
  { name: 'Goose Creek Golf Club', region: 'Inland Empire', city: 'Mira Loma', holes: [18], api: 'ottogolf', facilityId: 'goosecreek', scheduleId: '3', alias: 'goose-creek' },
  { name: 'Sierra Lakes Golf Club', region: 'Inland Empire', city: 'Fontana', holes: [18], api: 'teeitup', alias: 'sierra-lakes-golf-club' },

  // Atlanta
  { name: 'Browns Mill Golf Course', region: 'Atlanta', city: 'Atlanta', holes: [18], api: 'teeitup', alias: 'browns-mill-golf-course' },
  { name: 'Chastain Park Golf Course', region: 'Atlanta', city: 'Atlanta', holes: [18], api: 'teeitup', alias: 'chastain-park' },
  { name: "Alfred 'Tup' Holmes Golf Course", region: 'Atlanta', city: 'Atlanta', holes: [18], api: 'teeitup', alias: 'alfred-tup-holmes' },
];
