// 英雄与怪物 demo 的静态模板数据。
export type ValorHeroClass = "Warrior" | "Sorcerer" | "Paladin";
export type ValorMonsterKind = "Dragon" | "Exoskeleton" | "Spirit";
export type ValorItemKind = "weapon" | "armor" | "potion" | "spell";
export type ValorSpellType = "fire" | "ice" | "lightning";

export type ValorHeroTemplate = {
  id: string;
  name: string;
  heroClass: ValorHeroClass;
  mana: number;
  strength: number;
  agility: number;
  dexterity: number;
  gold: number;
  experience: number;
};

export type ValorMonsterTemplate = {
  id: string;
  name: string;
  kind: ValorMonsterKind;
  level: number;
  damage: number;
  defense: number;
  dodge: number;
};

export type ValorItemTemplate = {
  id: string;
  name: string;
  kind: ValorItemKind;
  cost: number;
  minLevel: number;
  damage?: number;
  defense?: number;
  healHp?: number;
  healMana?: number;
  spellType?: ValorSpellType;
  spellDamage?: number;
  manaCost?: number;
};

export const valorHeroes: ValorHeroTemplate[] = [
  {
    id: "gaerdal-ironhand",
    name: "Gaerdal Ironhand",
    heroClass: "Warrior",
    mana: 100,
    strength: 700,
    agility: 500,
    dexterity: 600,
    gold: 1354,
    experience: 7,
  },
  {
    id: "flandal-steelskin",
    name: "Flandal Steelskin",
    heroClass: "Warrior",
    mana: 200,
    strength: 750,
    agility: 650,
    dexterity: 700,
    gold: 2500,
    experience: 7,
  },
  {
    id: "rillifane-rallathil",
    name: "Rillifane Rallathil",
    heroClass: "Sorcerer",
    mana: 1300,
    strength: 750,
    agility: 450,
    dexterity: 500,
    gold: 2500,
    experience: 9,
  },
  {
    id: "reign-havoc",
    name: "Reign Havoc",
    heroClass: "Sorcerer",
    mana: 800,
    strength: 800,
    agility: 800,
    dexterity: 800,
    gold: 2500,
    experience: 8,
  },
  {
    id: "parzival",
    name: "Parzival",
    heroClass: "Paladin",
    mana: 300,
    strength: 750,
    agility: 650,
    dexterity: 700,
    gold: 2500,
    experience: 7,
  },
  {
    id: "amaryllis-astra",
    name: "Amaryllis Astra",
    heroClass: "Paladin",
    mana: 500,
    strength: 500,
    agility: 500,
    dexterity: 500,
    gold: 2500,
    experience: 5,
  },
];

export const valorMonsters: ValorMonsterTemplate[] = [
  { id: "desghidorrah", name: "Desghidorrah", kind: "Dragon", level: 3, damage: 300, defense: 400, dodge: 35 },
  { id: "chrysophylax", name: "Chrysophylax", kind: "Dragon", level: 2, damage: 200, defense: 500, dodge: 20 },
  { id: "natsunomeryu", name: "Natsunomeryu", kind: "Dragon", level: 1, damage: 100, defense: 200, dodge: 10 },
  { id: "fellbrute", name: "Fellbrute", kind: "Exoskeleton", level: 3, damage: 260, defense: 480, dodge: 15 },
  { id: "ironcarapace", name: "Ironcarapace", kind: "Exoskeleton", level: 5, damage: 420, defense: 620, dodge: 18 },
  { id: "shade-whisper", name: "Shade Whisper", kind: "Spirit", level: 2, damage: 180, defense: 220, dodge: 38 },
  { id: "spectra-vex", name: "Spectra Vex", kind: "Spirit", level: 4, damage: 350, defense: 300, dodge: 42 },
];

export const valorItems: ValorItemTemplate[] = [
  { id: "bronze-edge", name: "Bronze Edge", kind: "weapon", cost: 800, minLevel: 1, damage: 180 },
  { id: "sunforged-blade", name: "Sunforged Blade", kind: "weapon", cost: 1800, minLevel: 3, damage: 320 },
  { id: "sentinel-mail", name: "Sentinel Mail", kind: "armor", cost: 900, minLevel: 1, defense: 70 },
  { id: "wyrmplate", name: "Wyrmplate", kind: "armor", cost: 2200, minLevel: 4, defense: 140 },
  { id: "healing-draught", name: "Healing Draught", kind: "potion", cost: 300, minLevel: 1, healHp: 220 },
  { id: "mana-flask", name: "Mana Flask", kind: "potion", cost: 280, minLevel: 1, healMana: 180 },
  {
    id: "ember-lance",
    name: "Ember Lance",
    kind: "spell",
    cost: 950,
    minLevel: 2,
    spellType: "fire",
    spellDamage: 240,
    manaCost: 120,
  },
  {
    id: "glacier-bite",
    name: "Glacier Bite",
    kind: "spell",
    cost: 1000,
    minLevel: 2,
    spellType: "ice",
    spellDamage: 220,
    manaCost: 110,
  },
  {
    id: "storm-chain",
    name: "Storm Chain",
    kind: "spell",
    cost: 1200,
    minLevel: 3,
    spellType: "lightning",
    spellDamage: 280,
    manaCost: 140,
  },
];
