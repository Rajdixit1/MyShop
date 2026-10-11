"""Product catalogue, part D: sugar/salt, dairy, cleaning, personal care, baby care, breakfast."""

from .seed_products_a import p

PRODUCTS_D = [
    # ---- Sugar, Salt & Others ----
    p("rock-salt-1kg", "Sendha Namak", "Daal Boro", "sugar-salt",
      45, 55, "1 kg", 4.1, 9400, 260, 130, "\U0001F9C2", "#eef1f5",
      "Rock salt for pickling and fasting meals.", ["Natural Rock Salt"]),
    p("brown-sugar-1kg", "Light Brown Sugar", "Daal Boro", "sugar-salt",
      78, 92, "1 kg", 4.2, 12100, 340, 120, "\U0001F9C2", "#c98b4b",
      "Unrefined light brown sugar with molasses.", ["Unrefined", "Natural"]),
    p("powdered-sugar-500g", "Powdered Sugar", "Daal Boro", "sugar-salt",
      40, 48, "500 g", 4.1, 6800, 150, 140, "\U0001F9C2", "#ffffff",
      "Fine icing sugar for baking and sweets.", ["Fine Powder", "Baking"]),

    # ---- Dairy & Frozen ----
    p("amul-doodh-1l", "Amul Toned Milk", "Amul", "dairy",
      68, 72, "1 L", 4.3, 48300, 2140, 100, "\U0001F95B", "#f1f7ff",
      "Toned milk with 3.0% fat, UHT processed.", ["Toned", "Vitamin A&D"]),
    p("mother-dairy-doodh-1l", "Mother Dairy Cow Milk", "Mother Dairy", "dairy",
      78, 82, "1 L", 4.4, 32900, 1520, 90, "\U0001F95B", "#eaf3ff",
      "Full fat cow milk, rich in protein and calcium.", ["Full Fat", "Cow Milk"], bestseller=True),
    p("amul-butter-100g", "Amul Butter", "Amul", "dairy",
      62, 70, "100 g", 4.4, 29800, 1180, 110, "\U0001F9C8", "#ffeeba",
      "Rich creamy white butter for toast and paratha.", ["Creamy", "Pure"]),
    p("amul-cheese-slices-200g", "Amul Cheese Slices", "Amul", "dairy",
      165, 195, "200 g", 4.2, 21400, 890, 70, "\U0001F9C0", "#ffef9f",
      "Delicious melt-in-mouth cheese slices for burgers.", ["Melt Easy", "Yolk Free"], deal=True),
    p("paneer-200g", "Fresh Paneer", "Mother Dairy", "dairy",
      95, 105, "200 g", 4.3, 38700, 1780, 60, "\U0001F9C0", "#fdfbf3",
      "Soft fresh paneer for curries and snacks.", ["Soft", "Fresh Daily"], bestseller=True),
    p("curd-400g", "Set Curd", "Mother Dairy", "dairy",
      42, 48, "400 g", 4.2, 24100, 910, 80, "\U0001F964", "#fffef8",
      "Thick set curd, no added sugar.", ["No Sugar", "Thick Set"]),

    # ---- Cleaning & Household ----
    p("vim-dishwash-500ml", "Vim Dishwash Gel", "Vim", "cleaning",
      128, 155, "500 ml", 4.4, 39800, 1890, 90, "\U0001F9FD", "#a7d8f0",
      "Powerful gel that cuts through greasy dishes.", ["Gel Formula", "Stain Removal"],
      bestseller=True, deal=True),
    p("ghadi-dishwash-1l", "Ghadi Dishwash Bar", "Ghadi", "cleaning",
      62, 72, "1 L", 4.1, 14300, 520, 100, "\U0001F9F4", "#ffe3b0",
      "Value pack dishwash bar for daily use.", ["Value Pack", "Strong Cleaning"]),
    p("surf-excel-matic-1kg", "Surf Excel Matic", "Surf Excel", "cleaning",
      235, 285, "1 kg", 4.4, 41200, 2020, 70, "\U0001F9FD", "#b3e5fc",
      "Washing powder for bright, clean clothes.", ["Matic", "Low Suds", "Bright Wash"],
      bestseller=True),
    p("ariel-2kg", "Ariel Colour & Style", "Ariel", "cleaning",
      620, 760, "2 kg", 4.3, 22900, 1130, 40, "\U0001F9FD", "#c8b6ff",
      "Premium detergent for coloured clothes.", ["Colour Care", "Stain Removal"]),
    p("harpic-toilet-1l", "Harpic Toilet Cleaner", "Harpic", "cleaning",
      155, 185, "1 L", 4.4, 52400, 2670, 75, "\U0001F6BD", "#a0e7e5",
      "Powerful toilet cleaner for a spotless bathroom.", ["99.9% Germ Kill", "Bleach"],
      bestseller=True),
    p("domestos-floor-1l", "Domestos Floor Cleaner", "Domestos", "cleaning",
      110, 130, "1 L", 4.3, 31200, 1420, 85, "\U0001F9FD", "#cdeac0",
      "Strong floor cleaner for a germ-free home.", ["Germ Buster"]),
]