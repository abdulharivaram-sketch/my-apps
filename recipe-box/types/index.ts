export interface Ingredient {
  quantity: number | null;
  unit: string | null;
  name: string;
  note?: string | null;
}

export interface Step {
  text: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  is_archived: boolean;
  is_public: boolean;
  share_id: string;
  created_at: string;
  updated_at: string;
}

export type RecipeDraft = Pick<
  Recipe,
  | "title" | "description" | "image_url" | "source_url"
  | "servings" | "prep_minutes" | "cook_minutes"
  | "ingredients" | "steps" | "tags"
>;

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  created_at: string;
}

export interface GroceryList {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GroceryItem {
  id: string;
  list_id: string;
  user_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  is_checked: boolean;
  source_recipe: string | null;
  position: number;
  created_at: string;
}
