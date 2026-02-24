import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NutrientInfo {
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
}

export interface FoodMatch {
  fdcId: number;
  description: string;
  brandName?: string;
  nutrients: NutrientInfo;
  servingSize?: number;
  servingSizeUnit?: string;
  confidence: number;
}

export interface USDAFoodItem {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  dataType: string;
  foodNutrients: Array<{
    nutrientId: number;
    nutrientName: string;
    nutrientNumber: string;
    value: number;
    unitName: string;
  }>;
  servingSize?: number;
  servingSizeUnit?: string;
}

// Common Spanish to English food translations for better USDA matching
const SPANISH_TO_ENGLISH: Record<string, string> = {
  // Proteins
  'pollo': 'chicken',
  'pechuga': 'chicken breast',
  'muslo': 'chicken thigh',
  'carne': 'beef',
  'res': 'beef',
  'cerdo': 'pork',
  'pescado': 'fish',
  'atún': 'tuna',
  'atun': 'tuna',
  'salmón': 'salmon',
  'salmon': 'salmon',
  'camarones': 'shrimp',
  'huevo': 'egg',
  'huevos': 'eggs',
  'jamón': 'ham',
  'jamon': 'ham',
  'tocino': 'bacon',

  // Grains & Carbs
  'arroz': 'rice',
  'arroz blanco': 'white rice',
  'arroz integral': 'brown rice',
  'pan': 'bread',
  'pasta': 'pasta',
  'fideos': 'noodles',
  'tortilla': 'tortilla',
  'avena': 'oatmeal',
  'cereal': 'cereal',
  'quinoa': 'quinoa',
  'papa': 'potato',
  'papas': 'potatoes',
  'papas fritas': 'french fries',
  'camote': 'sweet potato',
  'yuca': 'cassava',
  'plátano': 'banana',
  'platano': 'banana',

  // Dairy
  'leche': 'milk',
  'queso': 'cheese',
  'yogurt': 'yogurt',
  'yogur': 'yogurt',
  'mantequilla': 'butter',
  'crema': 'cream',

  // Fruits
  'manzana': 'apple',
  'naranja': 'orange',
  'banana': 'banana',
  'fresa': 'strawberry',
  'fresas': 'strawberries',
  'uvas': 'grapes',
  'sandía': 'watermelon',
  'sandia': 'watermelon',
  'piña': 'pineapple',
  'pina': 'pineapple',
  'mango': 'mango',
  'papaya': 'papaya',
  'aguacate': 'avocado',

  // Vegetables
  'ensalada': 'salad',
  'lechuga': 'lettuce',
  'tomate': 'tomato',
  'cebolla': 'onion',
  'zanahoria': 'carrot',
  'brócoli': 'broccoli',
  'brocoli': 'broccoli',
  'espinaca': 'spinach',
  'elote': 'corn',
  'choclo': 'corn',
  'frijoles': 'beans',
  'frijol': 'beans',
  'lentejas': 'lentils',
  'garbanzos': 'chickpeas',

  // Common dishes
  'sopa': 'soup',
  'caldo': 'broth',
  'tacos': 'tacos',
  'burrito': 'burrito',
  'empanada': 'empanada',
  'arepa': 'arepa',
  'sandwich': 'sandwich',
  'hamburguesa': 'hamburger',
  'pizza': 'pizza',

  // Drinks (specific variants first - longer phrases matched first due to sort)
  'café sin azúcar': 'coffee black unsweetened',
  'cafe sin azucar': 'coffee black unsweetened',
  'café negro': 'black coffee',
  'cafe negro': 'black coffee',
  'café con leche': 'coffee with milk',
  'cafe con leche': 'coffee with milk',
  'café con azúcar': 'coffee with sugar',
  'cafe con azucar': 'coffee with sugar',
  'café con aceite de coco': 'coffee with coconut oil',
  'cafe con aceite de coco': 'coffee with coconut oil',
  'café': 'coffee',
  'cafe': 'coffee',
  'té sin azúcar': 'tea unsweetened',
  'te sin azucar': 'tea unsweetened',
  'té verde': 'green tea',
  'te verde': 'green tea',
  'té': 'tea',
  'te': 'tea',
  'jugo natural': 'fresh juice',
  'jugo': 'juice',
  'agua peregrino': 'mineral water',
  'agua mineral': 'mineral water',
  'agua con gas': 'sparkling water',
  'agua natural': 'water',
  'agua': 'water',
  'refresco': 'soda',
  'cerveza': 'beer',
  'vino': 'wine',
  'licuado': 'smoothie',

  // Snacks & Sweets
  'galletas': 'cookies',
  'chocolate': 'chocolate',
  'helado': 'ice cream',
  'pastel': 'cake',
  'torta': 'cake',
  'dulce': 'candy',
  'nueces': 'nuts',
  'almendras': 'almonds',
  'cacahuates': 'peanuts',
  'maní': 'peanuts',
  'mani': 'peanuts',

  // Dairy variants
  'leche descremada': 'skim milk',
  'leche entera': 'whole milk',
  'leche deslactosada': 'lactose free milk',
  'yogurt natural': 'plain yogurt',
  'yogurt griego': 'greek yogurt',

  // Oils & fats
  'aceite de coco': 'coconut oil',
  'aceite de oliva': 'olive oil',
  'aceite': 'cooking oil',
  'mantequilla de maní': 'peanut butter',
  'mantequilla de mani': 'peanut butter',
  'crema de cacahuate': 'peanut butter',

  // Cooking methods & modifiers
  'sin azúcar': 'unsweetened',
  'sin azucar': 'unsweetened',
  'con azúcar': 'with sugar',
  'con azucar': 'with sugar',
  'sin grasa': 'fat free',
  'integral': 'whole grain',
  'frito': 'fried',
  'asado': 'grilled',
  'hervido': 'boiled',
  'al horno': 'baked',
  'a la plancha': 'grilled',
  'al vapor': 'steamed',
};

@Injectable()
export class NutritionService {
  private readonly logger = new Logger(NutritionService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://api.nal.usda.gov/fdc/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('USDA_API_KEY');
    if (!this.apiKey) {
      this.logger.warn('USDA_API_KEY not configured - nutrition lookup will be disabled');
    }
  }

  /**
   * Search for foods in USDA database and return nutritional information
   */
  async searchFood(query: string, limit = 5): Promise<FoodMatch[]> {
    if (!this.apiKey) {
      this.logger.debug('USDA API key not configured, skipping search');
      return [];
    }

    try {
      // Translate Spanish terms to English for better matching
      const englishQuery = this.translateToEnglish(query);
      this.logger.debug(`Searching USDA for: "${query}" -> "${englishQuery}"`);

      const response = await fetch(`${this.baseUrl}/foods/search?api_key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: englishQuery,
          pageSize: limit,
          dataType: ['Foundation', 'SR Legacy'],
        }),
      });

      if (!response.ok) {
        this.logger.error(`USDA API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      const foods: USDAFoodItem[] = data.foods || [];

      const matches = foods.map((food, index) => this.mapToFoodMatch(food, index, limit));
      if (matches.length > 0) {
        this.logger.debug(`USDA results for "${englishQuery}": ${matches.length} matches, best: "${matches[0].description}" conf=${matches[0].confidence} cal=${matches[0].nutrients.calories}`);
      } else {
        this.logger.debug(`USDA no results for "${englishQuery}"`);
      }
      return matches;
    } catch (error) {
      this.logger.error(`Error searching USDA: ${error}`);
      return [];
    }
  }

  /**
   * Get detailed nutrition info for a specific food by FDC ID
   */
  async getFoodDetails(fdcId: number): Promise<FoodMatch | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/food/${fdcId}?api_key=${this.apiKey}`,
      );

      if (!response.ok) {
        this.logger.error(`USDA API error: ${response.status}`);
        return null;
      }

      const food: USDAFoodItem = await response.json();
      return this.mapToFoodMatch(food, 0, 1);
    } catch (error) {
      this.logger.error(`Error getting food details: ${error}`);
      return null;
    }
  }

  /**
   * Estimate calories for a food item, using USDA if available, otherwise returns null
   */
  // Items that are definitively zero calories — USDA search is unreliable for these
  // (e.g. returns branded flavored "WATER" with 42 cal/100g instead of plain water)
  private readonly ZERO_CAL_PATTERNS = [
    'agua', 'water', 'agua mineral', 'agua peregrino', 'agua con gas',
    'agua natural', 'sparkling water', 'mineral water', 'agua de la llave',
    'agua embotellada', 'bottled water', 'té sin azúcar', 'te sin azucar',
    'black coffee', 'café sin azúcar', 'cafe sin azucar', 'café negro', 'cafe negro',
  ];

  async estimateCalories(
    foodName: string,
    quantity?: number,
    unit?: string,
  ): Promise<{ calories: number; source: 'usda' | 'estimate'; match?: FoodMatch } | null> {
    // Short-circuit for zero-calorie items — USDA often matches wrong branded products
    const lowerFood = foodName.toLowerCase().trim();
    if (this.ZERO_CAL_PATTERNS.some(p => lowerFood === p || lowerFood.includes(p))) {
      this.logger.debug(`Zero-cal override for "${foodName}"`);
      return {
        calories: 0,
        source: 'usda',
        match: {
          fdcId: 0,
          description: foodName,
          nutrients: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          confidence: 1,
        },
      };
    }

    const matches = await this.searchFood(foodName, 3);

    // Find first USDA result that is actually relevant to the query
    const englishQuery = this.translateToEnglish(foodName);
    const bestMatch = matches.find(m => m.confidence >= 0.3 && this.isRelevantMatch(englishQuery, m.description));

    if (bestMatch) {
      const qty = quantity || 1;

      // USDA nutrients are per 100g. Convert to per-serving using servingSize,
      // then multiply by quantity (number of servings/portions).
      const servingFactor = bestMatch.servingSize ? bestMatch.servingSize / 100 : 1;
      const multiplier = servingFactor * qty;

      const adjustedNutrients: NutrientInfo = {
        calories: Math.round(bestMatch.nutrients.calories * multiplier),
        protein: bestMatch.nutrients.protein != null ? Math.round(bestMatch.nutrients.protein * multiplier) : undefined,
        carbs: bestMatch.nutrients.carbs != null ? Math.round(bestMatch.nutrients.carbs * multiplier) : undefined,
        fat: bestMatch.nutrients.fat != null ? Math.round(bestMatch.nutrients.fat * multiplier) : undefined,
        fiber: bestMatch.nutrients.fiber != null ? Math.round(bestMatch.nutrients.fiber * multiplier) : undefined,
        sugar: bestMatch.nutrients.sugar != null ? Math.round(bestMatch.nutrients.sugar * multiplier) : undefined,
      };

      this.logger.debug(`USDA calc: per100g=${bestMatch.nutrients.calories} servingSize=${bestMatch.servingSize}g qty=${qty} → ${adjustedNutrients.calories} kcal`);

      return {
        calories: adjustedNutrients.calories,
        source: 'usda',
        match: { ...bestMatch, nutrients: adjustedNutrients },
      };
    }

    return null;
  }

  /**
   * Check if a USDA result description is relevant to the search query.
   * Prevents accepting garbage matches (e.g. "MEGA MIX CANDY" for "whopper").
   */
  private isRelevantMatch(query: string, description: string): boolean {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const descLower = description.toLowerCase();
    // At least one significant query word must appear in the USDA description
    return queryWords.some(w => descLower.includes(w));
  }

  /**
   * Translate Spanish food terms to English for better USDA matching
   */
  private translateToEnglish(query: string): string {
    let translated = query.toLowerCase();

    // Sort by length descending to match longer phrases first
    const sortedEntries = Object.entries(SPANISH_TO_ENGLISH)
      .sort((a, b) => b[0].length - a[0].length);

    for (const [spanish, english] of sortedEntries) {
      const regex = new RegExp(`\\b${spanish}\\b`, 'gi');
      translated = translated.replace(regex, english);
    }

    return translated;
  }

  /**
   * Map USDA food item to our FoodMatch interface
   */
  private mapToFoodMatch(food: USDAFoodItem, index: number, total: number): FoodMatch {
    const nutrients = this.extractNutrients(food.foodNutrients);

    // Calculate confidence based on position and data completeness
    const positionScore = 1 - (index / total) * 0.3;
    const dataScore = nutrients.calories > 0 ? 1 : 0.5;
    const confidence = Number((positionScore * dataScore).toFixed(2));

    return {
      fdcId: food.fdcId,
      description: food.description,
      brandName: food.brandName || food.brandOwner,
      nutrients,
      servingSize: food.servingSize,
      servingSizeUnit: food.servingSizeUnit,
      confidence,
    };
  }

  /**
   * Extract relevant nutrients from USDA nutrient array
   */
  private extractNutrients(
    foodNutrients: USDAFoodItem['foodNutrients'],
  ): NutrientInfo {
    const nutrientMap: Record<string, number> = {};

    // USDA nutrient IDs (nutrientId) and nutrient numbers (nutrientNumber)
    const NUTRIENT_IDS = {
      ENERGY: ['1008', '2047', '2048', '208'], // Energy (kcal)
      PROTEIN: ['1003', '203'],
      CARBS: ['1005', '2039', '205'],
      FAT: ['1004', '204'],
      FIBER: ['1079', '291'],
      SUGAR: ['2000', '1063', '269'],
    };

    for (const nutrient of foodNutrients) {
      const id = nutrient.nutrientNumber || String(nutrient.nutrientId);

      if (NUTRIENT_IDS.ENERGY.includes(id)) {
        nutrientMap.calories = nutrient.value;
      } else if (NUTRIENT_IDS.PROTEIN.includes(id)) {
        nutrientMap.protein = nutrient.value;
      } else if (NUTRIENT_IDS.CARBS.includes(id)) {
        nutrientMap.carbs = nutrient.value;
      } else if (NUTRIENT_IDS.FAT.includes(id)) {
        nutrientMap.fat = nutrient.value;
      } else if (NUTRIENT_IDS.FIBER.includes(id)) {
        nutrientMap.fiber = nutrient.value;
      } else if (NUTRIENT_IDS.SUGAR.includes(id)) {
        nutrientMap.sugar = nutrient.value;
      }
    }

    return {
      calories: Math.round(nutrientMap.calories || 0),
      protein: nutrientMap.protein ? Math.round(nutrientMap.protein) : undefined,
      carbs: nutrientMap.carbs ? Math.round(nutrientMap.carbs) : undefined,
      fat: nutrientMap.fat ? Math.round(nutrientMap.fat) : undefined,
      fiber: nutrientMap.fiber ? Math.round(nutrientMap.fiber) : undefined,
      sugar: nutrientMap.sugar ? Math.round(nutrientMap.sugar) : undefined,
    };
  }

  /**
   * Check if the service is configured and available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}
