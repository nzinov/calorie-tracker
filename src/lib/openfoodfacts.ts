// Open Food Facts API client - free, no auth required

const API_URL = 'https://world.openfoodfacts.org/cgi/search.pl'

export type OpenFoodFactsProduct = {
  product_name?: string
  brands?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
    fiber_100g?: number
    salt_100g?: number
  }
}

export async function searchFoods(query: string, maxResults: number = 8): Promise<OpenFoodFactsProduct[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(maxResults),
  })

  const response = await fetch(`${API_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': 'CalorieTracker/1.0 (https://github.com/anthropics/calorie-tracker)',
    },
  })

  if (!response.ok) {
    throw new Error(`Open Food Facts search failed: ${response.status}`)
  }

  const data = await response.json()
  return data.products || []
}

// Helper to format search results for AI consumption
export async function foodSearch(query: string): Promise<string> {
  try {
    const products = await searchFoods(query, 8)

    // Filter out products without essential nutrition data
    const validProducts = products.filter(p =>
      p.product_name &&
      p.nutriments?.['energy-kcal_100g'] !== undefined
    )

    if (validProducts.length === 0) {
      return `No foods found for "${query}". Try a different search term or estimate the nutritional values.`
    }

    const results = validProducts.map((p, i) => {
      const name = p.product_name || 'Unknown'
      const brand = p.brands ? ` (${p.brands})` : ''
      const n = p.nutriments || {}
      const cal = Math.round(n['energy-kcal_100g'] || 0)
      const protein = (n.proteins_100g || 0).toFixed(1)
      const carbs = (n.carbohydrates_100g || 0).toFixed(1)
      const fat = (n.fat_100g || 0).toFixed(1)
      const fiber = (n.fiber_100g || 0).toFixed(1)
      const salt = (n.salt_100g || 0).toFixed(2)

      return `${i + 1}. **${name}**${brand}\n   Per 100g: ${cal} kcal, protein ${protein}g, carbs ${carbs}g, fat ${fat}g, fiber ${fiber}g, salt ${salt}g`
    }).join('\n\n')

    return `Found ${validProducts.length} results for "${query}":\n\n${results}`
  } catch (error) {
    return `Food search failed: ${error}. Try estimating nutritional values instead.`
  }
}
