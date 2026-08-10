-- Seed sample recipes so the library isn't empty.
-- 1) Sign up once in the app.  2) Supabase → Authentication → Users → copy your UUID.
-- 3) Replace every :uid below with that UUID (keep the quotes).  4) Run in SQL Editor.

insert into public.recipes
  (user_id, title, description, image_url, servings, prep_minutes, cook_minutes, ingredients, steps, tags)
values
(':uid', 'Weeknight Garlic Butter Pasta',
 'Fast, cozy, five ingredients.', 'https://d8j0ntlcm91z4.cloudfront.net/user_3EuIT2gg179SyxLyM66cygkcbtM/hf_20260809_200857_b06bf6d8-bb52-4d82-be5e-a32afea0b311.png',
 2, 5, 15,
 '[{"quantity":200,"unit":"g","name":"spaghetti","note":null},
   {"quantity":3,"unit":"tbsp","name":"butter","note":null},
   {"quantity":4,"unit":"cloves","name":"garlic","note":"minced"},
   {"quantity":0.5,"unit":"cup","name":"parmesan","note":"grated"},
   {"quantity":null,"unit":null,"name":"salt & pepper","note":"to taste"}]'::jsonb,
 '[{"text":"Boil spaghetti in salted water until al dente."},
   {"text":"Melt butter, add garlic, cook 1 minute."},
   {"text":"Toss pasta with butter, garlic, parmesan and a splash of pasta water."},
   {"text":"Season and serve."}]'::jsonb,
 array['pasta','quick','vegetarian']),
(':uid', 'Sheet-Pan Lemon Chicken',
 'Hands-off dinner.', 'https://d8j0ntlcm91z4.cloudfront.net/user_3EuIT2gg179SyxLyM66cygkcbtM/hf_20260809_200857_71c044be-e07e-4b76-8891-1b4c5c3b1dae.png',
 4, 10, 35,
 '[{"quantity":4,"unit":null,"name":"chicken thighs","note":null},
   {"quantity":1,"unit":null,"name":"lemon","note":"sliced"},
   {"quantity":2,"unit":"tbsp","name":"olive oil","note":null},
   {"quantity":1,"unit":"tsp","name":"paprika","note":null}]'::jsonb,
 '[{"text":"Heat oven to 220C."},
   {"text":"Toss chicken with oil, paprika, lemon."},
   {"text":"Roast 30-35 min until golden."}]'::jsonb,
 array['chicken','dinner','sheet-pan']),
(':uid', 'Overnight Oats',
 'Prep tonight, breakfast sorted.', 'https://d8j0ntlcm91z4.cloudfront.net/user_3EuIT2gg179SyxLyM66cygkcbtM/hf_20260809_200857_f25354bc-3222-49d8-a041-d57e177a8989.png',
 1, 5, 0,
 '[{"quantity":0.5,"unit":"cup","name":"rolled oats","note":null},
   {"quantity":0.5,"unit":"cup","name":"milk","note":"any"},
   {"quantity":1,"unit":"tbsp","name":"chia seeds","note":null},
   {"quantity":1,"unit":"tsp","name":"honey","note":null},
   {"quantity":null,"unit":null,"name":"berries","note":"to top"}]'::jsonb,
 '[{"text":"Stir everything except berries in a jar."},
   {"text":"Refrigerate overnight."},
   {"text":"Top with berries in the morning."}]'::jsonb,
 array['breakfast','no-cook','meal-prep']);
