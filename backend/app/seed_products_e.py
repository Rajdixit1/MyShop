"""Product catalogue, part E: personal care, baby care, breakfast & instant."""

from .seed_products_a import p

PRODUCTS_E = [
    # ---- Bath & Personal Care ----
    p("dove-soap-100g", "Dove Beauty Bar", "Dove", "personal-care",
      52, 62, "100 g", 4.4, 62700, 3120, 130, "\U0001FAE7", "#fde7ef",
      "Moisturising beauty soap with glycerin.", ["Glycerin", "Moisturising"], bestseller=True),
    p("lux-soap-100g", "Lux Beauty Soap", "Lux", "personal-care",
      45, 55, "100 g", 4.2, 58400, 2670, 140, "\U0001FAE7", "#ffe0e6",
      "Fragrant deodant soap for glowing skin.", ["Fragrance", "Glow"]),
    p("sunsilk-shampoo-190ml", "Sunsilk Shampoo", "Sunsilk", "personal-care",
      105, 125, "190 ml", 4.1, 29800, 1180, 90, "\U0001F4AE", "#f8bbd0",
      "Silky shine shampoo for smooth hair.", ["Silky Shine", "SLS Free"]),
    p("colgate-strong-teeth-150g", "Colgate Strong Teeth", "Colgate", "personal-care",
      88, 105, "150 g", 4.5, 44200, 2140, 120, "\U0001FAA5", "#d5f0ff",
      "Cavity protection toothpaste with fluoride.", ["Fluoride", "Cavity Protection"],
      bestseller=True),
    p("garnier-face-wash-100g", "Garnier Face Wash", "Garnier", "personal-care",
      135, 165, "100 g", 4.3, 31800, 1420, 70, "\U0001FAE7", "#c8e6c9",
      "Neem face wash for oily and acne-prone skin.", ["Neem", "Oil Free"], deal=True),
    p("vaseline-400ml", "Vaseline Blistex Lip Therapy", "Vaseline", "personal-care",
      165, 199, "400 ml", 4.2, 22100, 870, 60, "\U0001F484", "#ffdad1",
      "Deep moisturising body lotion for dry skin.", ["Deep Moisturise", "Non Sticky"]),

    # ---- Baby Care ----
    p("pampers-diaper-m-20", "Pampers Baby Diaper-M", "Pampers", "baby-care",
      549, 649, "20 pcs", 4.5, 28500, 1320, 60, "\U0001F37C", "#c9e7ff",
      "Extra absorb diapers with wetness indicator.", ["Extra Absorb", "Wetness Indicator"],
      bestseller=True, deal=True),
    p("johnson-baby-lotion-200ml", "Johnson's Baby Lotion", "Johnson's", "baby-care",
      245, 290, "200 ml", 4.4, 19400, 780, 70, "\U0001F476", "#ffe9f2",
      "Gentle moisturising baby lotion with natural extracts.", ["Gentle", "Daily Care"]),
    p("baby-wipes-72", "Huggies Baby Wipes", "Huggies", "baby-care",
      165, 199, "72 wipes", 4.3, 14200, 560, 80, "\U0001F9FD", "#e8f5e9",
      "Extra gentle wipes for newborn skin.", ["Extra Gentle", "Alcohol Free"]),

    # ---- Breakfast & Instant ----
    p("maggi-noodles-12", "Maggi 2-Minute Noodles", "Nestle", "breakfast",
      138, 156, "12 pack", 4.3, 76300, 4210, 140, "\U0001F35C", "#ffd08a",
      "Classic masala instant noodles, ready in 2 minutes.", ["2 Minutes", "Vegetarian"],
      bestseller=True, deal=True),
    p("cornflakes-750g", "Kellogg's Cornflakes", "Kellogg's", "breakfast",
      320, 385, "750 g", 4.3, 21400, 940, 60, "\U0001F33F", "#ffe08a",
      "Crispy corn flakes breakfast cereal with vitamins.", ["Vitamins", "Fibre", "Crispy"]),
    p("suji-upma-500g", "Suji (Semolina)", "Daal Boro", "breakfast",
      68, 85, "500 g", 4.2, 13100, 430, 110, "\U0001F33F", "#fff3cf",
      "Coarse semolina for upma, halwa and rava.", ["Coarse", "No Maida"]),
    p("poha-mix-masala", "Poha Masala Mix", "Daal Boro", "breakfast",
      92, 110, "200 g", 4.1, 6700, 210, 95, "\U0001F35E", "#f7e3b0",
      "Ready-to-cook masala poha mix with flavour.", ["Ready to Cook", "Masala Taste"], deal=True),
    p("honey-500g", "Natural Honey", "Dabur", "breakfast",
      425, 520, "500 g", 4.4, 17800, 720, 50, "\U0001F41D", "#ffc933",
      "Pure natural honey for tea, toast and sweets.", ["Pure", "No Sugar", "Ayurvedic"]),
    p("jam-400g", "Mixed Fruit Jam", "Kissan", "breakfast",
      145, 175, "400 g", 4.1, 11200, 350, 80, "\U0001F347", "#ff9aa2",
      "Tangy mixed fruit jam for toast and pancakes.", ["Real Fruit", "No Preservatives"]),
]