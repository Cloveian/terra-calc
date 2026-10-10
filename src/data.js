// Game data only, no logic. Prices as of 9 Oct 2026 (Prep 2), from /device-upgrades.
// TODO: Make userscrpipt grab device prices from ingame
// Sources: research/how-terra-works.md, research/device-trees.md

export const PRICES_AS_OF = "2026-10-09";

export const PREP1_START = "2026-09-28"; // Monday, US Eastern
export const PREP_WEEKS = 3;
export const MAIN_WEEKS = 12;

export const MAX_PLOTS = 45;
export const FREE_PLOTS = 10;
export const PLOT_PRICE_MAX = 10; // plot price is min(1 + bought, 10)
export const BASE_SEEDS = 10;     // carrots from Ratticus each week
export const RENT = 10;           // crops, main weeks only
export const RENT_PAY = 20;       // coins per rent crop (dev, 10 Oct)

export const CROPS = {
    carrot: { buy: null, sell: 25 },
    apple:  { buy: 5,    sell: 30 },
};

export const MULTIPLIER = { min: 0.8, max: 1.5 };
export const STARTING_COINS = 25;

// Tree keys and node ids are Terra's own ids from /device-upgrades.
// cost: one price, or tiers: a price per buy (limit = tiers.length)
// limit: 1 by default, null = no limit, { base, per } = base + how many `per` you own
// requires: list of node ids, all needed first ([] = hangs off the device itself)
export const TREES = {
    framework_12: {
        device: "Framework 12",
        nodes: [
            { id: "stylus_12",               name: "Framework Stylus",         cost: 500,  requires: [] },
            { id: "expansion_card_12",       name: "USB Expansion Card",       cost: 100,  requires: [], limit: null },
            { id: "fancy_expansion_card_12", name: "Fancy Expansion Card",     cost: 100,  requires: [], limit: { base: 4, per: "expansion_card_12" } },
            { id: "framework_12_diy",        name: "Framework 12 DIY Edition", cost: 250,  requires: [] },
            { id: "ram_12",                  name: "RAM",                      tiers: [750, 1300, 2100], requires: ["framework_12_diy"] },
            { id: "ssd_12",                  name: "SSD",                      tiers: [1000, 2000],      requires: ["framework_12_diy"] },
            { id: "cpu_12",                  name: "Core 3 304",               cost: 400,  requires: ["framework_12_diy"] },
            { id: "cpu_i5_1334u",            name: "i5-1334U",                 cost: 400,  requires: ["cpu_12"] },
            { id: "cpu_core5_320",           name: "Core 5 320",               cost: 1500, requires: ["cpu_i5_1334u"] },
            { id: "framework_13_upgrade",    name: "Framework 13",             cost: 500,  requires: ["cpu_core5_320"] },
            { id: "display_2k8_12",          name: "2.8K Display",             cost: 900,  requires: ["framework_13_upgrade"] },
            { id: "cpu_ryzen_ai7_350",       name: "Ryzen AI 7 350",           cost: 2250, requires: ["framework_13_upgrade"] },
        ],
    },
    ipad_mini: {
        device: "iPad Mini",
        nodes: [
            { id: "apple_pencil",         name: "Apple Pencil",         cost: 750,  requires: [] },
            { id: "ipad_air_11",          name: "iPad Air 11",          cost: 400,  requires: [] },
            { id: "smart_folio",          name: "Smart Folio",          cost: 600,  requires: [] },
            { id: "apple_pencil_pro",     name: "Apple Pencil Pro",     cost: 400,  requires: ["apple_pencil"] },
            { id: "ipad_air_13",          name: "iPad Air 13",          cost: 1600, requires: ["ipad_air_11"] },
            { id: "ipad_pro_11",          name: "iPad Pro 11",          cost: 2000, requires: ["ipad_air_13"] },
            { id: "magic_keyboard_folio", name: "Magic Keyboard Folio", cost: 1600, requires: ["smart_folio", "ipad_air_11"] },
        ],
    },
    galaxy_tab_s10_fe: {
        device: "Galaxy Tab S10 FE+",
        nodes: [
            { id: "galaxy_tab_s11",      name: "Galaxy Tab S11",           cost: 2400, requires: [] },
            { id: "smart_book_cover",    name: "Smart Book Cover",         cost: 800,  requires: [] },
            { id: "galaxy_tab_s10_plus", name: "Galaxy Tab S10+",          cost: 800,  requires: ["galaxy_tab_s11"] },
            { id: "book_cover_keyboard", name: "Book Cover Keyboard Slim", cost: 400,  requires: ["smart_book_cover"] },
        ],
    },
};

// Preset buttons, in this order. To add one, add a line: prerequisites get added automatically,
// so { cpu_ryzen_ai7_350: 1 } is enough for "everything up to the Ryzen".
export const PRESETS = {
    framework_12: {
        "Framework 13": {
            framework_12_diy: 1, cpu_12: 1, cpu_i5_1334u: 1, cpu_core5_320: 1, framework_13_upgrade: 1,
        },
        "Max 12": {
            stylus_12: 1, expansion_card_12: 1, fancy_expansion_card_12: 4, framework_12_diy: 1,
            ram_12: 3, ssd_12: 2, cpu_12: 1, cpu_i5_1334u: 1, cpu_core5_320: 1,
        },
        "Max 12, no extra USB": {
            stylus_12: 1, fancy_expansion_card_12: 4, framework_12_diy: 1,
            ram_12: 3, ssd_12: 2, cpu_12: 1, cpu_i5_1334u: 1, cpu_core5_320: 1,
        },
        "Max 13": {
            expansion_card_12: 1, fancy_expansion_card_12: 4, framework_12_diy: 1, ram_12: 3, ssd_12: 2,
            cpu_12: 1, cpu_i5_1334u: 1, cpu_core5_320: 1, framework_13_upgrade: 1,
            display_2k8_12: 1, cpu_ryzen_ai7_350: 1,
        },
        "Max 13, no extra USB": {
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
    { device: "framework_12", when: ["stylus_12", "framework_13_upgrade"], text: "The stylus doesn't work on the Framework 13." },
];
