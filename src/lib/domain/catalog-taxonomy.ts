/**
 * Keyword rules that give the master catalog its categories.
 *
 * Rose Mart's 2,147 products arrived 98% uncategorised, and a picker you cannot
 * browse is just a search box. These rules turn raw names into shelf-shaped
 * categories a Pakistani shopkeeper recognises.
 *
 * Most of the work is a Pakistani FMCG brand dictionary: a generic word list
 * only reached 55% coverage on real Rose Mart data, because shelves here are
 * stocked by brand ("VATIKA", "GLUCO", "MOLFIX"), not by noun.
 *
 * Online barcode lookup was measured and rejected: Open Food Facts returned
 * 1 hit in 25 on this data, and that hit had no categories. These are local
 * brands (BISKO, KHAAS, OCAKE) that no international product database indexes,
 * and many carry non-Pakistani GS1 prefixes from cheap imports. Reading the
 * name is the only thing that works here.
 *
 * Misspellings that actually occur in shop data are matched on purpose
 * (PALIMOLIVE, DETTPL, HEAD & SHUOLDER, PENTENE, COGATE, MORTINE). They are not
 * typos to fix; they are what the shopkeeper typed and will type again.
 *
 * First match wins, so specific rules precede generic ones. Output is meant to
 * be reviewed in a CSV before seeding, not trusted blindly. Genuinely ambiguous
 * names (SPECIAL, NUMBER 1, MORO, OPAL) are left unmatched on purpose: a wrong
 * category is worse than an empty one.
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
  ['Confectionery', /(dairy\s?milk|kitkat|kit\s?kat|snicker|bounty|twix|galaxy|mars\b|toblerone|ferrero|cocomo|chocolate|chocolat|chocolayte|\bcandy\b|toffee|lolly\s?pop|lollypop|lollipop|chupa|eclair|chewing\s?gum|bubble\s?gum|\bgum\b|mentos|tic\s?tac|halls|strepsil|jelly\s?bean|marshmallow|marshmalll?ow|mallow|\bchoco\b|choc\s?bar|choc\s?stik|cabury|cadbury|\bperk\b|\byums\b|\brocket\b|boomo|boom\s?boom|ding\s?dong|dingdong|funny\s?bunny|crazy\s?dips|chil\s?mili|fruities|\bchews\b|monsi|\btopic\b|mood\s?on|milky\s?treat|softmints|fresh\s?up|cocodelite|velvetti|praline|goodies|pum\s?pum|\bbuzzy\b)/i],
  // Before Personal Care, or Dettol antiseptic follows Dettol soap.
  ['Health', /(antiseptic|savlon|is[ab]?p?[ab]?ghol|isabgol|joshanda|panadol|disprin|brufen|\bors\b|glucose|glucon|vitamin|supplement|band\s?aid|bandage|cotton\s?wool|thermometer|\bmask\b|sanitizer|cough\s?syrup|\bbalm\b|vicks|tiger\s?balm|canderel|sucral|dr\.?\s?koff|arq\s?e\s?gulab)/i],
  ['Baby', /(pamper|molfix|huggies|canbebe|bumper|diaper|nappy|\bbaby\b|cerelac|lactogen|\bnan\s?\d|pediasure|feeder|soother|wipes|johnson|nana\s?(lrg|mdm|xxl|\d))/i],
  ['Cigarettes', /(cigarette|gold\s?leaf|marlboro|capstan|morven|dunhill|pall\s?mall|benson|\bk2\b|captain\s?black|gold\s?flake|john\s?player|parliament|red\s?&?\s?white|gold\s?street|paan\s?bahar)/i],
  ['Frozen', /(frozen|nugget|kabab|kebab|\bfries\b|sausage|paratha|samosa|patties|spring\s?roll|\bk\s?&\s?n\b|\bkn\b|monsalwa|sabroso|\bdawn\b|\bmenu\b|ice\s?cream|\bwalls\b|omore|\bhico\b|cornetto|\bfeast\b|kulf[ia]|ice\s?lolly|viennetta|crazy\s?cone|paddle\s?pop|caramel\s?&?\s?vanilla|vanilla\s?1\s?l)/i],
  ['Desserts & Baking', /(laziza|dessert|custard|jelly|kheer|firni|halwa|halva|baking\s?powder|\byeast\b|cocoa|icing|cake\s?mix|china\s?grass|falooda|jam\s?e\s?shirin|trifle|pudding|food\s?colou?r|kewra|vanilla\s?essence|culinary)/i],
  ['Tea & Coffee', /(tapal|lipton|supreme|danedar|\btea\b|\bchai\b|coffee|coffe\s?rich|nescafe|espresso|green\s?tea|tetley|vital\s?tea|kenya|\bcafe\b|yellow\s?lable|yellow\s?label)/i],
  ['Dairy', /(\bmilk\b|olper|milkpak|\bnido\b|everyday|tarang|yogurt|yoghurt|dahi|\bcream\b|butter|cheese|condensed|milk\s?pak|\bdairy\b|lassi|\bkhoya\b|margarine|blue\s?band|whit[en]er|single\s?slices|bunyad)/i],
  ['Biscuits', /(biscuit|\bgluco\b|sooper|\bprince\b|\btuc\b|\bcandi\b|\bmarie\b|zeera\s?plus|oreo|\brio\b|bisconni|peek\s?freans|\bl\.?u\.?\b|\bep\b|\bgala\b|wafer|waffle|\bpie\b|chocolato|novita|sandwich\s|khatai|cookie|cracker|\btiger\b|digestive|wheatable|\bparty\b|bisca\b|biskela|bisko|milano|little\s?hearts|mini\s?fingers|\brite\b|bona\s?papa|cake\s?bar|swiss\s?roll|chip\s?roll|chum\s?roll|cupbite|sweet\s?bites|teatime)/i],
  ['Bakery', /(bread|\brusk\b|\bcake\b|\bbun\b|pizza|pastry|muffin|donut|doughnut|crust|bakeri|bakery|dabal\s?roti|double\s?roti|\bnaan\b|sheermal|cup\s?kake|cupcake|ocake|brownie)/i],
  ['Snacks', /(chips|\blays\b|kurkure|slanty|slany|nimko|nimco|super\s?crisp|cheetos|wavy|pop\s?corn|nachos|\btito\b|\bfryo\b|peanut|badam|almond|\bkaju\b|cashew|pista|chilgoza|makhan|dry\s?fruit|dates\b|corn\s?flakes|corne?\s?pops|cereal|\boats\b|snack|\bchip\b|fauji|popsi|potato\s?stick|potato\s?master|\bcrave\b|puffs?\b|crispoo|\bringo\b|bistiks|krisko|chunkin|hazmazza|\btokry\b|sopper)/i],
  ['Cooking Oil & Ghee', /(cooking\s?oil|banaspat[ti]i?|\bghee\b|dalda|\bsufi\b|\bkisan\b|habib|canola|sunflower\s?oil|olive\s?oil|\beva\b|manpasand|soya\s?oil|tullo|kashmir\s?oil|mezan|khopra)/i],
  ['Atta, Rice & Pulses', /(\batta\b|flour|maida|\bsuji\b|besan|\brice\b|chawal|basmati|sella|\bdaal\b|\bdal\b|lentil|chana|masoor|moong|\bmash\b|lobia|\bbeans\b|sabudana|vermicelli|\bsewian\b|macaroni|pasta|spaghetti|noodle|maggi|knorr\s?noodle|knoor|porridge)/i],
  ['Spices & Masala', /(\bshan\b|nat[ti]?ional\s|mehran|\bmasala\b|\bsalt\b|namak|haldi|turmeric|\bmirch\b|chilli|chili|\bzeera\b|cumin|garam|dhania|coriander|elaichi|cardamom|paprika|acha+ri?|pickle|\bspice\b|kalonji|methi|\bajwain\b|imli|tamarind|black\s?pepper|kali\s?mirch|seasoning|glinger|nihari|biryani|korma|tikka|oregano|kofta|choran|chatni)/i],
  ['Sauces & Condiments', /(ketchup|\bsauce\b|mayo|mayonnaise|vinegar|\bjam\b|honey|shehad|chutney|\bpaste\b|\bdip\b|mustard|soya\s?sauce|chilli\s?garlic|shangril+a|\bknorr\b|sprea[dst]|coctail|cocktail)/i],
  ['Laundry & Cleaning', /(\bsurf\b|\bariel\b|\bbonus\b|express\s?power|\bcomfort\b|softener|detergent|washing\s?powder|dish\s?wash|dishwash|\bvim\b|harpic|bleach|lemon\s?max|\bfinis\b|\brobin\b|\bneel\b|toilet\s?clean|glass\s?clean|floor\s?clean|phenyl|stain|\bbrite\b|sunlight|lemon\s?fesh|blue\s?liquid|liquid\s?refill|origi?n?al\s?lemon|oll\s?clean|big\s?cleaning)/i],
  ['Personal Care', /(shampoo|conditioner|vatika|sunsilk|pantene|pentene|head\s?&?\s?sh[ou]{2}lder|\bclear\b|\bdove\b|life\s?buoy|\blux\b|safeguard|dettol|dettpl|\bcapri\b|palmolive|palimolive|palimolve|polimolive|loreal|elvive|garnier|\bnivea\b|\bponds\b|\bolay\b|fair\s?&?\s?lovely|glow\s?&?\s?lovely|glow\s?and\s?lovely|radiant\s?glow|\bgoree\b|golden\s?pearl|kessar|belini|enchanteur|\bjosh\b|\baxe\b|deodorant|body\s?spray|bodyspray|perfume|\bdeo\b|\btreet\b|gillet+e|gellette|\brazor\b|shaving|shave|trim\s?ii|olivia|hair\s?colo|\bhenna\b|mehndi|hair\s?oil|brylcreem|jasmine|vaseline|petroleum\s?jelly|glycerin|lotion|face\s?wash|facewash|\bscrub\b|sunblock|sunscreen|toothpaste|colgate|cogate|colseup|sensodyne|close\s?up|closeup|fluoride|medicam|miswak|toothbrush|oral\s?b|listerine|mouthwash|max\s?fresh|sanitary\s?(pad|napkin)|\balways\b|\bsofy\b|\bbutterfly\b|carefree|mother\s?comf|\bveet\b|set\s?&?\s?wet|se?t\s?wet|nail\s?saver|\bsensa\b|freshrite|miss\s?world|lotus\s?creme|creme\s?lotus|\bsoap\b|talcum|shower\s?gel|hand\s?wash|handwash|cotton\s?bud|ezigrip|sunslik|\bpiano\b|dentist|\btibet\b)/i],
  ['Household', /(kingtox|mortein|mortine|\braid\b|mosquito|mosqik|\bcoil\b|insect|\bspray\b|air\s?freshener|freshner|room\s?spray|tissue|tiisue|rose\s?petal|\bfoil\b|cling|garbage|shopping\s?bag|\bmatch(es)?\b|candle|scrubber|scouring|scotch\s?brite|\bbroom\b|\bsweep\b|sweepy|naphthalene|\bbattery\b|batteries|power\s?plus|\bbulb\b|lighter|agarbatti|\bmop\b|duster|gloves|sponge|dustbin|\bwiper\b|shoe\s?shine|shiner|cherry\s?blossom|\bpolish\b|\bkiwi\b|bin\s?bag|paper\s?cup|disposable|straw|toshiba|hanger|toothpick|mouse\s?&?\s?rat|depoxi)/i],
  ['Stationery', /(\bpen\b|pencil|notebook|\bcopy\b|\bregister\b|eraser|sharpener|\bglue\b|samad\s?bond|marker|stapler|\bscale\b|\bruler\b|geometry|envelope|\btape\b|file\s?cover|sketch|colou?r\s?box|\bdollar\b|\bdux\b|\bopus\b|clip+er|high\s?liner|jetflow|dry\s?erase|pointer)/i],
  // Generic drink words last: "juice"/"water" appear inside many names above.
  ['Beverages', /(\bcola\b|pepsi|coca|\bcoke\b|\b7\s?up\b|sprite|fanta|mirinda|\bdew\b|\bsting\b|red\s?bull|\btang\b|gourmet|lemon\s?up|lemon\s?malt|next\s?cola|pakola|\bjui+ce\b|nectar|fruita|\bslice\b|\bmaza\b|frooto|shezan|\brani\b|\bdrink\b|\bwater\b|aquafina|kinley|dasani|nestle\s?pure|gatorade|sharbat|rooh\s?afza|squash|\bmalta\b|\bsoda\b|energy\s?drink|\bsyrup\b|fruitien|fizup|chaunsa|big\s?apple|ever\s?flow|quice|mango\s?tango|frisk[ey]+y?|aamrus|ting\s?zing|twister)/i],
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

/**
 * Normalise a name for the shared catalog: strip stray brackets, collapse
 * whitespace, force UPPERCASE.
 *
 * Deliberately minimal. Misspellings stay ("DETTPL", "SUNSLIK", "SCRUBER") -
 * they are what shopkeepers type and will type again, and the rules above match
 * them on purpose. Only square brackets and braces go, because those are
 * scanner and keyboard slips ("LYCHEE]"), never part of a product name.
 * Parentheses stay: they carry real information, as in "NESTLE BUNYAD (260G)".
 */
export function normalizeCatalogName(raw: string): string {
  return raw
    .replace(/[[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/**
 * Normalise a scannable code for the shared catalog.
 *
 * A real GTIN (8-14 digits: EAN-8, UPC-A, EAN-13, GTIN-14) is the ideal, but it
 * is not the only thing a scanner returns. Local Pakistani products carry QR
 * payloads ("http://myproduct.info/ckxS") and vendor codes ("ALFB525267979"),
 * and a scanner reads those back exactly as stored - so they identify the
 * product perfectly well and belong in the catalog.
 *
 * Accepting them cannot pollute the shared catalog, because promotion needs two
 * independent shops (see catalog.ts). A code only one shop ever uses stays
 * PENDING and invisible forever; one that several shops scan is, by definition,
 * a shared identifier.
 *
 * What is still rejected: anything with whitespace, or longer than 64 chars.
 * That is not a code someone scanned, it is a field someone typed into by
 * mistake - Rose Mart has a whole marketing paragraph sitting in one.
 */
export function normalizeCatalogBarcode(raw?: string | null): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (/^[0-9]{8,14}$/.test(s)) return s
  if (/\s/.test(s) || s.length < 8 || s.length > 64) return null
  return s
}
