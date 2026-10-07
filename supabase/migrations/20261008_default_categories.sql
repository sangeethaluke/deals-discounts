-- Starter categories only; safe to rerun and preserves existing categories.
insert into public.categories(name,icon) values
 ('Footwear','footprints'),
 ('Chicken & Meat','beef'),
 ('Clothing','shirt'),
 ('Branded Stores','store'),
 ('Groceries','carrot'),
 ('Stationery','pencil'),
 ('Snacks','cookie'),
 ('Restaurants','utensils')
on conflict(name) do nothing;
