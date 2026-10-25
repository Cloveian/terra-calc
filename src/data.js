// Game data only, no logic. Prices as of 9 Oct 2026 (Prep 2), from /device-upgrades.
// Sources: research/how-terra-works.md, research/device-trees.md

export const PRICES_AS_OF = "2026-10-09";

export const PREP1_START = "2026-09-28"; // Monday, US Eastern
export const PREP_WEEKS = 3;
export const MAIN_WEEKS = 12;

export const MAX_PLOTS = 45;
export const FREE_PLOTS = 10;
export const PLOT_PRICE_MAX = 10; // plot price is min(1 + bought, 10)
export const BASE_SEEDS = 10;     // free from ratticus weekly. carrots in prep, strawberries from week 1, same numbers
export const BASE_KINDS = { prep: "carrot", main: "strawberry" };
export const RENT = 10;           // crops, main weeks only
export const RENT_PAY = 20;       // coins for a whole week's rent (all 10 crops together), * m (dev, 10 Oct)

export const CROPS = {
    carrot: { buy: null, sell: 25, water: 1 }, // base seed, strawberries since week 1 (same numbers)
    apple:  { buy: 5,    sell: 30, water: 1, name: "Apple" },
    // bonus seeds, only in heidi's shop on the days she offers them
    // key = short name in links and the seed box id, stuck once links are out there
    bokchoy:  { name: "Bok Choy", buy: 10, sell: 37, water: 1, bonus: true, key: "bok" },
    eggplant: { name: "Eggplant", buy: 15, sell: 75, water: 2, bonus: true, key: "egg" },
};
export const BONUS_SEEDS = Object.keys(CROPS).filter((id) => CROPS[id].bonus);

export const MULTIPLIER = { min: 0.8, max: 1.5 };
export const STARTING_COINS = 25;

// Tree keys and node ids are Terra's own ids from /device-upgrades.
// cost: one price, or tiers: a price per buy (limit = tiers.length)
// totals: what you end up with: [none bought, after 1 buy, after 2, ...] (from the game's tier notes)
// limit: 1 by default, null = no limit, { base, per } = base + how many `per` you own
// requires: list of node ids, all needed first ([] = hangs off the device itself)
// root, x, y: where Terra's own tree draws the device and each node (y grows downwards)
export const TREES = {
    framework_12: {
        device: "Framework 12",
        root: { x: -20, y: 180 },
        nodes: [
            { id: "stylus_12",               name: "Framework Stylus",         cost: 500,  requires: [], x: -230, y: 385 },
            { id: "expansion_card_12",       name: "USB Expansion Card",       cost: 100,  requires: [], limit: null, x: 55, y: 420 },
            { id: "fancy_expansion_card_12", name: "Fancy Expansion Card",     cost: 100,  requires: [], limit: { base: 4, per: "expansion_card_12" }, x: 195, y: 355 },
            { id: "framework_12_diy",        name: "Framework 12 DIY Edition", cost: 250,  requires: [], x: -20, y: -165 },
            { id: "ram_12",                  name: "RAM",                      tiers: [750, 1300, 2100], totals: ["8 GB", "16 GB", "32 GB", "48 GB"], requires: ["framework_12_diy"], x: -315, y: -170 },
            { id: "ssd_12",                  name: "SSD",                      tiers: [1000, 2000],      totals: ["500 GB", "1 TB", "2 TB"],     requires: ["framework_12_diy"], x: 280, y: -190 },
            { id: "cpu_12",                  name: "Core 3 304",               cost: 400,  requires: ["framework_12_diy"], x: -55, y: -405 },
            { id: "cpu_i5_1334u",            name: "i5-1334U",                 cost: 400,  requires: ["cpu_12"], x: -335, y: -565 },
            { id: "cpu_core5_320",           name: "Core 5 320",               cost: 1500, requires: ["cpu_i5_1334u"], x: -360, y: -770 },
            { id: "framework_13_upgrade",    name: "Framework 13",             cost: 500,  requires: ["cpu_core5_320"], x: 100, y: -890 },
            { id: "display_2k8_12",          name: "2.8K Display",             cost: 900,  requires: ["framework_13_upgrade"], x: -150, y: -945 },
            { id: "cpu_ryzen_ai7_350",       name: "Ryzen AI 7 350",           cost: 2250, requires: ["framework_13_upgrade"], x: 305, y: -605 },
        ],
    },
    ipad_mini: {
        device: "iPad Mini",
        root: { x: 5, y: 245 },
        nodes: [
            { id: "apple_pencil",         name: "Apple Pencil",         cost: 750,  requires: [], x: -265, y: -215 },
            { id: "ipad_air_11",          name: "iPad Air 11",          cost: 400,  requires: [], x: -65, y: -50 },
            { id: "smart_folio",          name: "Smart Folio",          cost: 600,  requires: [], x: 300, y: 5 },
            { id: "apple_pencil_pro",     name: "Apple Pencil Pro",     cost: 400,  requires: ["apple_pencil"], x: -450, y: -690 },
            { id: "ipad_air_13",          name: "iPad Air 13",          cost: 1600, requires: ["ipad_air_11"], x: 50, y: -430 },
            { id: "ipad_pro_11",          name: "iPad Pro 11",          cost: 2000, requires: ["ipad_air_13"], x: -105, y: -820 },
            { id: "magic_keyboard_folio", name: "Magic Keyboard Folio", cost: 1600, requires: ["smart_folio", "ipad_air_11"], x: 445, y: -200 },
        ],
    },
    galaxy_tab_s10_fe: {
        device: "Galaxy Tab S10 FE+",
        root: { x: 10, y: 255 },
        nodes: [
            { id: "galaxy_tab_s11",      name: "Galaxy Tab S11",           cost: 2400, requires: [], x: 50, y: -430 },
            { id: "smart_book_cover",    name: "Smart Book Cover",         cost: 800,  requires: [], x: -250, y: -220 },
            { id: "galaxy_tab_s10_plus", name: "Galaxy Tab S10+",          cost: 800,  requires: ["galaxy_tab_s11"], x: -105, y: -825 },
            { id: "book_cover_keyboard", name: "Book Cover Keyboard Slim", cost: 400,  requires: ["smart_book_cover"], x: -455, y: -690 },
        ],
    },
};

// Preset buttons, in this order. To add one, add a line: prerequisites get added automatically,
// so { cpu_ryzen_ai7_350: 1 } is enough for "everything up to the Ryzen".
export const PRESETS = {
    framework_12: {
        "Up to Framework 13": {
            framework_12_diy: 1, cpu_12: 1, cpu_i5_1334u: 1, cpu_core5_320: 1, framework_13_upgrade: 1,
        },
        "Max 12": {
            stylus_12: 1, expansion_card_12: 1, fancy_expansion_card_12: 4, framework_12_diy: 1,
            ram_12: 3, ssd_12: 2, cpu_12: 1, cpu_i5_1334u: 1, cpu_core5_320: 1,
        },
        "Max 12 (no USB card)": {
            stylus_12: 1, fancy_expansion_card_12: 4, framework_12_diy: 1,
            ram_12: 3, ssd_12: 2, cpu_12: 1, cpu_i5_1334u: 1, cpu_core5_320: 1,
        },
        "Max 13": {
            expansion_card_12: 1, fancy_expansion_card_12: 4, framework_12_diy: 1, ram_12: 3, ssd_12: 2,
            cpu_12: 1, cpu_i5_1334u: 1, cpu_core5_320: 1, framework_13_upgrade: 1,
            display_2k8_12: 1, cpu_ryzen_ai7_350: 1,
        },
        "Max 13 (no USB card)": {
            fancy_expansion_card_12: 4, framework_12_diy: 1, ram_12: 3, ssd_12: 2,
            cpu_12: 1, cpu_i5_1334u: 1, cpu_core5_320: 1, framework_13_upgrade: 1,
            display_2k8_12: 1, cpu_ryzen_ai7_350: 1,
        },
    },
    ipad_mini: {
        "Everything": {
            apple_pencil: 1, ipad_air_11: 1, smart_folio: 1, apple_pencil_pro: 1,
            ipad_air_13: 1, ipad_pro_11: 1, magic_keyboard_folio: 1,
        },
    },
    galaxy_tab_s10_fe: {
        "Everything": {
            galaxy_tab_s11: 1, smart_book_cover: 1, galaxy_tab_s10_plus: 1, book_cover_keyboard: 1,
        },
    },
};

// Red notes when all the `when` nodes are wanted together
export const PICK_WARNINGS = [
    { device: "framework_12", when: ["stylus_12", "framework_13_upgrade"], text: "The stylus only works on the Framework 12." },
];
