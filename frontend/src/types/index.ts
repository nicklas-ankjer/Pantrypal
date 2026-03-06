export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  created_at: string;
  updated_at: string;
}

export interface HomeStockItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  safety_stock: number;
  created_at: string;
  updated_at: string;
}

export interface EmergencyStockItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expiration_date: string;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  created_at: string;
  updated_at: string;
}

export interface IngredientAvailability {
  ingredient: string;
  required: number;
  unit: string;
  available: number;
  safety_stock: number;
  status: 'available' | 'below_safety' | 'missing' | 'insufficient';
  in_emergency_stock: boolean;
}

export interface DashboardData {
  low_stock_alerts: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    safety_stock: number;
  }[];
  expiring_items: {
    id: string;
    name: string;
    expiration_date: string;
    days_until_expiry: number;
  }[];
  recipes_you_can_cook: {
    id: string;
    name: string;
    available_ingredients: number;
    total_ingredients: number;
    percentage: number;
  }[];
  shopping_list_count: number;
  timestamp: string;
}
