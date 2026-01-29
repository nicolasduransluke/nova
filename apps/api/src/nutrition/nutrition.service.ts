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
  'plátano': 'plantain',
  'platano': 'plantain',

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

  // Drinks
  'café': 'coffee',
  'cafe': 'coffee',
  'té': 'tea',
  'te': 'tea',
  'jugo': 'juice',
  'agua': 'water',
  'refresco': 'soda',
  'cerveza': 'beer',
  'vino': 'wine',

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

  // Cooking methods (for context)
  'frito': 'fried',
  'asado': 'grilled',
  'hervido': 'boiled',
  'al horno': 'baked',
  'a la plancha': 'grilled',
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
          dataType: ['Foundation', 'SR Legacy', 'Branded'],
        }),
      });

      if (!response.ok) {
        this.logger.error(`USDA API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      const foods: USDAFoodItem[] = data.foods || [];

      return foods.map((food, index) => this.mapToFoodMatch(food, index, limit));
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
  async estimateCalories(
    foodName: string,
    quantity?: number,
    unit?: string,
  ): Promise<{ calories: number; source: 'usda' | 'estimate'; match?: FoodMatch } | null> {
    const matches = await this.searchFood(foodName, 3);

    if (matches.length > 0 && matches[0].confidence > 0.5) {
      const bestMatch = matches[0];
      let calories = bestMatch.nutrients.calories;

      // Adjust for quantity if provided
      if (quantity && bestMatch.servingSize) {
        // Assume user quantity is in grams unless specified
        const servingMultiplier = quantity / bestMatch.servingSize;
        calories = Math.round(calories * servingMultiplier);
      } else if (quantity) {
        // If no serving size info, use quantity as multiplier (assuming per 100g)
        calories = Math.round((calories / 100) * quantity);
      }

      return {
        calories,
        source: 'usda',
        match: bestMatch,
      };
    }

    return null;
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

    // USDA nutrient IDs
    const NUTRIENT_IDS = {
      ENERGY: ['1008', '2047', '2048'], // Energy (kcal)
      PROTEIN: ['1003'],
      CARBS: ['1005', '2039'],
      FAT: ['1004'],
      FIBER: ['1079'],
      SUGAR: ['2000', '1063'],
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
