/**
 * Client-side food image dictionary.
 * Used as fallback when the API doesn't return foodItems with imageUrl.
 * Maps Spanish/English food names to Unsplash CDN thumbnail URLs.
 */

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?w=200&h=200&fit=crop&q=80`;

const FOOD_IMAGES: Record<string, string> = {
  // Compound phrases
  'café sin azúcar': IMG('photo-1509042239860-f550ce710b93'),
  'cafe sin azucar': IMG('photo-1509042239860-f550ce710b93'),
  'café con leche': IMG('photo-1572442388796-11668a67e53d'),
  'cafe con leche': IMG('photo-1572442388796-11668a67e53d'),
  'café negro': IMG('photo-1509042239860-f550ce710b93'),
  'cafe negro': IMG('photo-1509042239860-f550ce710b93'),
  'arroz integral': IMG('photo-1586201375761-83865001e31c'),
  'arroz blanco': IMG('photo-1586201375761-83865001e31c'),
  'pollo a la plancha': IMG('photo-1532550907401-a500c9a57435'),
  'pollo asado': IMG('photo-1598103442097-8b74394b95c6'),
  'pollo frito': IMG('photo-1626082927389-6cd097cdc6ec'),
  'pescado a la plancha': IMG('photo-1519708227418-c8fd9a32b7a2'),
  'pescado frito': IMG('photo-1519708227418-c8fd9a32b7a2'),
  'yogurt natural': IMG('photo-1488477181946-6428a0291777'),
  'yogurt griego': IMG('photo-1488477181946-6428a0291777'),
  'pan integral': IMG('photo-1509440159596-0249088772ff'),
  'papas fritas': IMG('photo-1573080496219-bb080dd4f877'),
  'jugo natural': IMG('photo-1534353473418-4cfa6c56fd38'),
  'hamburguesa con queso': IMG('photo-1568901346375-23c9450c58cd'),
  'hamburguesa doble': IMG('photo-1568901346375-23c9450c58cd'),
  'hot dog': IMG('photo-1612392062126-2f5b8e1e4f3b'),
  'perro caliente': IMG('photo-1612392062126-2f5b8e1e4f3b'),

  // Base foods
  'pollo': IMG('photo-1598103442097-8b74394b95c6'),
  'chicken': IMG('photo-1598103442097-8b74394b95c6'),
  'arroz': IMG('photo-1586201375761-83865001e31c'),
  'rice': IMG('photo-1586201375761-83865001e31c'),
  'ensalada': IMG('photo-1512621776951-a57141f2eefd'),
  'salad': IMG('photo-1512621776951-a57141f2eefd'),
  'huevos': IMG('photo-1482049016688-2d3e1b311543'),
  'huevo': IMG('photo-1482049016688-2d3e1b311543'),
  'pan': IMG('photo-1509440159596-0249088772ff'),
  'bread': IMG('photo-1509440159596-0249088772ff'),
  'pasta': IMG('photo-1551183053-bf91a1d81141'),
  'fideos': IMG('photo-1551183053-bf91a1d81141'),
  'torta': IMG('photo-1578985545062-69928b1d9587'),
  'pizza': IMG('photo-1565299624946-b28f40a0ae38'),
  'pescado': IMG('photo-1519708227418-c8fd9a32b7a2'),
  'fish': IMG('photo-1519708227418-c8fd9a32b7a2'),
  'carne': IMG('photo-1546833999-b9f581a1996d'),
  'beef': IMG('photo-1546833999-b9f581a1996d'),
  'frijoles': IMG('photo-1536304993881-1f79b7d5c00e'),
  'tortilla': IMG('photo-1624300629298-e9209d5f1b8d'),
  'sandwich': IMG('photo-1528735602780-2552fd46c7af'),
  'sopa': IMG('photo-1547592166-23ac45744acd'),
  'soup': IMG('photo-1547592166-23ac45744acd'),
  'fruta': IMG('photo-1619566636858-adf3ef46400b'),
  'yogurt': IMG('photo-1488477181946-6428a0291777'),
  'cereal': IMG('photo-1517456793572-1d8efd6dc135'),
  'plátano': IMG('photo-1571771894821-ce9b6c11b08e'),
  'platano': IMG('photo-1571771894821-ce9b6c11b08e'),
  'banana': IMG('photo-1571771894821-ce9b6c11b08e'),
  'manzana': IMG('photo-1560806887-1e4cd0b6cbd6'),
  'apple': IMG('photo-1560806887-1e4cd0b6cbd6'),
  'naranja': IMG('photo-1547514701-42782101795e'),
  'uvas': IMG('photo-1537640538966-79f369143f8f'),
  'piña': IMG('photo-1550258987-190a2d41a8ba'),
  'mango': IMG('photo-1553279768-865429fa0078'),
  'fresa': IMG('photo-1464965911861-746a04b4bca6'),
  'leche': IMG('photo-1550583724-b2692b85b150'),
  'milk': IMG('photo-1550583724-b2692b85b150'),
  'queso': IMG('photo-1486297678162-eb2a19b0a32d'),
  'cheese': IMG('photo-1486297678162-eb2a19b0a32d'),
  'café': IMG('photo-1509042239860-f550ce710b93'),
  'cafe': IMG('photo-1509042239860-f550ce710b93'),
  'coffee': IMG('photo-1509042239860-f550ce710b93'),
  'avena': IMG('photo-1517673400267-0251440c45b0'),
  'oatmeal': IMG('photo-1517673400267-0251440c45b0'),
  'granola': IMG('photo-1517673400267-0251440c45b0'),
  'hamburguesa': IMG('photo-1568901346375-23c9450c58cd'),
  'hamburguesas': IMG('photo-1568901346375-23c9450c58cd'),
  'tacos': IMG('photo-1551504734-5ee1c4a1479b'),
  'taco': IMG('photo-1551504734-5ee1c4a1479b'),
  'burrito': IMG('photo-1626700051175-6818013e1d4f'),
  'empanada': IMG('photo-1604467707321-70d009801bf4'),
  'arepa': IMG('photo-1599750604667-5b72ae498673'),
  'tamales': IMG('photo-1530554764233-e79e16f91d08'),
  'tamal': IMG('photo-1530554764233-e79e16f91d08'),
  'galletas': IMG('photo-1499636136210-6f4ee915583e'),
  'chocolate': IMG('photo-1481391319762-47dff72954d9'),
  'helado': IMG('photo-1497034825429-c343d7c6a68f'),
  'jugo': IMG('photo-1534353473418-4cfa6c56fd38'),
  'licuado': IMG('photo-1553530666-ba11a7da3888'),
  'batido': IMG('photo-1553530666-ba11a7da3888'),
  'smoothie': IMG('photo-1553530666-ba11a7da3888'),
  'aguacate': IMG('photo-1523049673857-eb18f1d7b578'),
  'avocado': IMG('photo-1523049673857-eb18f1d7b578'),
  'atún': IMG('photo-1546069901-ba9599a7e63c'),
  'atun': IMG('photo-1546069901-ba9599a7e63c'),
  'jamón': IMG('photo-1524438418049-ab2acb7aa48f'),
  'jamon': IMG('photo-1524438418049-ab2acb7aa48f'),
  'papas': IMG('photo-1596097635092-6e7dc8f1c04f'),
  'papa': IMG('photo-1596097635092-6e7dc8f1c04f'),
  'camote': IMG('photo-1596097635092-6e7dc8f1c04f'),
  'lentejas': IMG('photo-1546549032-9571cd6b27df'),
  'garbanzos': IMG('photo-1515543904267-41e1b3082de8'),
  'nueces': IMG('photo-1563635860464-35cbf2d5e26a'),
  'almendras': IMG('photo-1563635860464-35cbf2d5e26a'),
  'mantequilla': IMG('photo-1589985270826-4b7bb135bc9d'),
  'miel': IMG('photo-1587049352851-8d4e89133924'),
};

/**
 * Look up an image URL for a food name.
 */
function getFoodImageUrl(name: string): string | undefined {
  const lower = name.toLowerCase().trim();
  if (FOOD_IMAGES[lower]) return FOOD_IMAGES[lower];

  // Strip quantity: "2 hamburguesas" -> "hamburguesas"
  const withoutQty = lower.replace(/^\d+\s+/, '');
  if (FOOD_IMAGES[withoutQty]) return FOOD_IMAGES[withoutQty];

  // Fuzzy: substring match
  for (const [key, url] of Object.entries(FOOD_IMAGES)) {
    if (lower.includes(key) || key.includes(lower)) return url;
  }
  return undefined;
}

/**
 * Parse food items from the text response and enrich with image URLs.
 * Used as fallback when API doesn't return foodItems.
 * Parses lines like "- hamburguesa: ~450 kcal"
 */
export function parseFoodItemsFromText(content: string): { name: string; calories: number; imageUrl?: string }[] | undefined {
  const lines = content.split('\n');
  const items: { name: string; calories: number; imageUrl?: string }[] = [];

  for (const line of lines) {
    const match = line.trim().match(/^-\s+(.+?):\s*~?(\d+)\s*kcal/i);
    if (match) {
      const name = match[1].trim();
      const calories = parseInt(match[2], 10);
      items.push({ name, calories, imageUrl: getFoodImageUrl(name) });
    }
  }

  return items.length > 0 ? items : undefined;
}
