/**
 * Keyword rules that give the master catalog its categories.
 *
 * Rose Mart's 2,147 products arrived 98% uncategorised, and a picker you cannot
 * browse is just a search box. These rules turn raw names into shelf-shaped
 * categories a Pakistani shopkeeper recognises.
 *
 * Most of the work is a Pakistani FMCG brand dictionary: a generic word list
 * only reached 55% coverage on real Rose Mart data, because shelves here are
 * stocked by brand ("VATIKA", "GLUCO", "MOLFIX"), not by noun. Misspellings that
 * actually occur in shop data are matched on purpose (PALIMOLIVE, DETTPL).
 *
 * First match wins, so specific rules precede generic ones. Output is meant to
 * be reviewed in a CSV before seeding, not trusted blindly.
 */

export const CATALOG_CATEGORIES = [
  'Beverages', 'Tea & Coffee', 'Dairy', 'Bakery', 'Biscuits', 'Snacks',
  'Confectionery', 'Desserts & Baking', 'Cooking Oil & Ghee',
  'Atta, Rice & Pulses', 'Spices & Masala', 'Sauces & Condiments', 'Frozen',
  'Baby', 'Personal Care', 'Health', 'Laundry & Cleaning', 'Household',
  'Cigarettes', 'Stationery',
] as const

export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number]

/** Ordered: earlier rules win. Sequence here is load-bearing, not cosmetic. */
const RULES: Array<[CatalogCategory, RegExp]> = [
  // Before Dairy, or "DAIRY MILK" chocolate lands in the milk aisle.
  ['Confectionery', /(dairy\s?milk|kitkat|kit\s?kat|snicker|bounty|twix|galaxy|mars\b|toblerone|ferrero|cocomo|chocolate|chocolat|candy|toffee|lollipop|chupa|eclair|chewing\s?gum|bubble\s?gum|\bgum\b|mentos|tic\s?tac|halls|strepsil|jelly\s?bean|marshmallow|\bchoco\b|cabury|cadbury|\bperk\b|\byums\b|\brocket\b)/i],
  // Before Personal Care, or Dettol antiseptic follows Dettol soap.
  ['Health', /(antiseptic|savlon|isapghol|isabgol|isbgol|joshanda|panadol|disprin|brufen|\bors\b|glucose|glucon|vitamin|supplement|band\s?aid|bandage|cotton\s?wool|thermometer|\bmask\b|sanitizer|cough\s?syrup|\bbalm\b|vicks|tiger\s?balm)/i],
  ['Baby', /(pamper|molfix|huggies|canbebe|bumper|diaper|nappy|\bbaby\b|cerelac|lactogen|\bnan\s?\d|pediasure|feeder|soother|wipes|johnson)/i],
  ['Cigarettes', /(cigarette|gold\s?leaf|marlboro|capstan|morven|dunhill|pall\s?mall|benson|\bk2\b)/i],
  ['Frozen', /(frozen|nugget|kabab|kebab|\bfries\b|sausage|paratha|samosa|patties|spring\s?roll|\bk\s?&\s?n\b|\bkn\b|monsalwa|sabroso|\bdawn\b|\bmenu\b|ice\s?cream|\bwalls\b|omore|\bhico\b|cornetto|\bfeast\b|kulfi|paddle)/i],
  ['Desserts & Baking', /(laziza|dessert|custard|jelly|kheer|firni|halwa|halva|baking\s?powder|\byeast\b|cocoa|icing|cake\s?mix|china\s?grass|falooda|jam\s?e\s?shirin|trifle|pudding)/i],
  ['Tea & Coffee', /(tapal|lipton|supreme|danedar|\btea\b|\bchai\b|coffee|nescafe|espresso|green\s?tea|tetley|vital\s?tea|kenya|\bcafe\b)/i],
  ['Dairy', /(\bmilk\b|olper|milkpak|\bnido\b|everyday|tarang|yogurt|yoghurt|dahi|\bcream\b|butter|cheese|condensed|milk\s?pak|\bdairy\b|lassi|\bkhoya\b|margarine|blue\s?band)/i],
  ['Biscuits', /(biscuit|\bgluco\b|sooper|\bprince\b|\btuc\b|\bcandi\b|\bmarie\b|zeera\s?plus|oreo|\brio\b|bisconni|peek\s?freans|\bl\.?u\.?\b|\bep\b|\bgala\b|wafer|\bpie\b|chocolato|novita|sandwich\s|nan\s?khatai|cookie|\btiger\b|digestive|wheatable|\bparty\b)/i],
  ['Bakery', /(bread|\brusk\b|\bcake\b|\bbun\b|pizza|pastry|muffin|donut|doughnut|crust|bakeri|bakery|dabal\s?roti|double\s?roti|\bnaan\b|sheermal)/i],
  ['Snacks', /(chips|\blays\b|kurkure|slanty|nimko|nimco|super\s?crisp|cheetos|wavy|popcorn|nachos|\btito\b|\bfryo\b|peanut|badam|almond|\bkaju\b|cashew|pista|chilgoza|makhana|dry\s?fruit|corn\s?flakes|cereal|\boats\b|snack|\bchip\b|fauji)/i],
  ['Cooking Oil & Ghee', /(cooking\s?oil|banaspati|\bghee\b|dalda|\bsufi\b|\bkisan\b|habib|canola|sunflower\s?oil|olive\s?oil|\beva\b|manpasand|soya\s?oil|tullo|kashmir\s?oil)/i],
  ['Atta, Rice & Pulses', /(\batta\b|flour|maida|\bsuji\b|besan|\brice\b|chawal|basmati|sella|\bdaal\b|\bdal\b|lentil|chana|masoor|moong|\bmash\b|lobia|\bbeans\b|sabudana|vermicelli|\bsewian\b|macaroni|pasta|spaghetti|noodle|maggi|knorr\s?noodle|knoor)/i],
  ['Spices & Masala', /(\bshan\b|national\s|mehran|\bmasala\b|\bsalt\b|namak|haldi|turmeric|\bmirch\b|chilli|chili|\bzeera\b|cumin|garam|dhania|coriander|elaichi|cardamom|paprika|\bachar\b|pickle|\bspice\b|kalonji|methi|\bajwain\b|imli|tamarind|black\s?pepper|kali\s?mirch)/i],
  ['Sauces & Condiments', /(ketchup|\bsauce\b|mayo|mayonnaise|vinegar|\bjam\b|honey|shehad|chutney|\bpaste\b|\bdip\b|mustard|soya\s?sauce|chilli\s?garlic|shangrila|\bknorr\b)/i],
  ['Laundry & Cleaning', /(\bsurf\b|\bariel\b|\bbonus\b|express\s?power|\bcomfort\b|softener|detergent|washing\s?powder|dish\s?wash|dishwash|\bvim\b|harpic|bleach|lemon\s?max|\bfinis\b|\brobin\b|\bneel\b|toilet\s?clean|glass\s?clean|floor\s?clean|phenyl|stain|\bbrite\b|sunlight)/i],
  ['Personal Care', /(shampoo|conditioner|vatika|sunsilk|pantene|head\s?&?\s?shoulder|\bclear\b|\bdove\b|lifebuoy|\blux\b|safeguard|dettol|dettpl|\bcapri\b|palmolive|palimolive|palimolve|loreal|elvive|garnier|\bnivea\b|\bponds\b|\bolay\b|fair\s?&?\s?lovely|glow\s?&?\s?lovely|glow\s?and\s?lovely|\bgoree\b|enchanteur|\bjosh\b|\baxe\b|deodorant|body\s?spray|bodyspray|perfume|\bdeo\b|\btreet\b|gillette|\brazor\b|shaving|shave|olivia|hair\s?colo|\bhenna\b|mehndi|hair\s?oil|brylcreem|jasmine|vaseline|petroleum\s?jelly|lotion|face\s?wash|facewash|\bscrub\b|sunblock|sunscreen|toothpaste|colgate|sensodyne|close\s?up|closeup|medicam|miswak|toothbrush|oral\s?b|listerine|mouthwash|sanitary\s?(pad|napkin)|\balways\b|\bsofy\b|\bbutterfly\b|mother\s?comfe?ort|\bsoap\b|talcum|shower\s?gel|hand\s?wash|handwash|ezigrip|sunslik|\bpiano\b|dentist|\btibet\b)/i],
  ['Household', /(kingtox|mortein|\braid\b|mosquito|insect|\bspray\b|air\s?freshener|room\s?spray|tissue|rose\s?petal|\bfoil\b|cling|garbage|shopping\s?bag|\bmatch\b|candle|scrubber|scotch\s?brite|\bbroom\b|naphthalene|\bbattery\b|batteries|\bbulb\b|lighter|agarbatti|\bmop\b|duster|gloves|sponge|dustbin|\bwiper\b|shoe\s?shine|shiner|\bpolish\b|\bkiwi\b|bin\s?bag|paper\s?cup|disposable|straw|toshiba)/i],
  ['Stationery', /(\bpen\b|pencil|notebook|\bcopy\b|\bregister\b|eraser|sharpener|\bglue\b|marker|stapler|\bscale\b|geometry|envelope|\btape\b|file\s?cover|sketch|colou?r\s?box)/i],
  // Generic drink words last: "juice"/"water" appear inside many names above.
  ['Beverages', /(\bcola\b|pepsi|coca|\b7\s?up\b|sprite|fanta|mirinda|\bdew\b|\bsting\b|red\s?bull|\btang\b|gourmet|lemon\s?up|next\s?cola|pakola|\bjuice\b|nectar|fruita|\bslice\b|\bmaza\b|frooto|shezan|\brani\b|\bdrink\b|\bwater\b|aquafina|kinley|nestle\s?pure|gatorade|sharbat|rooh\s?afza|squash|\bmalta\b|\bsoda\b|energy\s?drink|\bsyrup\b|fruitien|fizup|chaunsa)/i],
]

/**
 * Best-guess category for a product name, or null when nothing matches.
 * Null is deliberate: an "Other" bucket would hide how much went unsorted.
 */
export function categorize(name: string): CatalogCategory | null {
  const n = name.replace(/\s+/g, ' ').trim()
  for (const [category, re] of RULES) {
    if (re.test(n)) return category
  }
  return null
}

/** Normalise a name for the shared catalog: collapse whitespace, force UPPERCASE. */
export function normalizeCatalogName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toUpperCase()
}

/**
 * A barcode is only usable in a shared catalog if it is a real GTIN. Rose Mart
 * has a QR payload ("http://myproduct.info/...") and shop-local codes
 * ("ALFB525267979") sitting in barcode fields. 8-14 digits keeps EAN-8, UPC-A,
 * EAN-13 and GTIN-14 while dropping both.
 */
export function normalizeCatalogBarcode(raw?: string | null): string | null {
  const s = String(raw ?? '').trim()
  return /^[0-9]{8,14}$/.test(s) ? s : null
}
