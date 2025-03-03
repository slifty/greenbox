import {
  compress,
  FamiliarStatus,
  getOutfitTattoos,
  isPermable,
  ItemStatus,
  loadIotMs,
  loadPaths,
  loadTattoos,
  loadTrophies,
  PathDef,
  RawFamiliar,
  RawIotM,
  RawOutfitTattoo,
  RawPath,
  RawSkill,
  RawTrophy,
  SkillStatus,
  TattooDef,
  TattooStatus,
  TrophyDef,
  TrophyStatus,
} from "greenbox-data";
import {
  currentRound,
  Familiar,
  getPermedSkills,
  getRevision,
  handlingChoice,
  haveFamiliar,
  inMultiFight,
  Item,
  myId,
  myName,
  outfitPieces,
  printHtml,
  Skill,
  toInt,
  visitUrl,
} from "kolmafia";
import { getNumber, getBoolean } from "libram/dist/property";

import { getIotMStatus } from "./iotms";
import { haveItem } from "./utils";

/**
 * Generates an object with a list of IOTMs & ownership stats.
 * @returns large string of IOTM ownership
 */

function checkIotMs() {
  return (loadIotMs()?.data ?? []).map((iotm) => [iotm.id, getIotMStatus(iotm)] as RawIotM);
}

/**
 * Generates an object with a list of HC & SC skill perms.
 * @returns large numeric list of skills, comma delimited, in two sections
 */
function checkSkills() {
  // Key existence means permed in some way, true is HC, false is SC
  const permedSkills = getPermedSkills();

  function getStatus(skill: Skill) {
    if (toInt(skill) == 7254 && getNumber(`skillLevel7254`) > 0) {
      return SkillStatus.HARDCORE;
    }

    switch (permedSkills[skill.toString()]) {
      case true:
        return SkillStatus.HARDCORE;
      case false:
        return SkillStatus.SOFTCORE;
      default:
        return SkillStatus.NONE;
    }
  }

  function getLevel(skill: Skill) {
    return getNumber(`skillLevel${toInt(skill)}`);
  }

  return Skill.all()
    .filter((skill) => isPermable(toInt(skill)))
    .map((skill) => [toInt(skill), getStatus(skill), getLevel(skill)] as RawSkill);
}

/**
 * Generates a list of familiars with 100% runs
 */
function getHundredPercentFamiliars() {
  const history =
    visitUrl(`ascensionhistory.php?back=self&who=${myId()}`, false) +
    visitUrl(`ascensionhistory.php?back=self&prens13=1&who=${myId()}`, false);
  const set = new Set();
  const pattern = /alt="([^"]*?) \(100%\)/gm;
  let m;
  while ((m = pattern.exec(history)) !== null) set.add(Familiar.get(m[1]));
  return set;
}

/**
 * Generates an object with a list of familiars.
 * @returns large numeric list of familiars by fam ID
 */
function checkFamiliars() {
  const hundredPercentFamiliars = getHundredPercentFamiliars();

  function getStatus(familiar: Familiar) {
    if (haveFamiliar(familiar)) return FamiliarStatus.TERRARIUM;
    if (haveItem(familiar.hatchling)) return FamiliarStatus.HATCHLING;
    return FamiliarStatus.NONE;
  }

  function getHundredPercent(familiar: Familiar) {
    return hundredPercentFamiliars.has(familiar);
  }

  return Familiar.all().map(
    (familiar) => [toInt(familiar), getStatus(familiar), getHundredPercent(familiar)] as RawFamiliar
  );
}

/**
 * Generates an object with a list of trophy numbers.
 * @returns large numeric list of trophies by trophy number
 */
function checkTrophies() {
  const page = visitUrl("trophies.php");

  function getStatus(trophy: TrophyDef) {
    return page.includes(`"trophy${trophy.id}"`) ? TrophyStatus.HAVE : TrophyStatus.NONE;
  }

  return (loadTrophies()?.data ?? []).map((trophy) => [trophy.id, getStatus(trophy)] as RawTrophy);
}

function haveOutfitPieces(outfit: string) {
  return outfitPieces(outfit).every((piece) => haveItem(piece));
}

function checkOutfitTattoos(page: string) {
  function getStatus(tattoo: TattooDef) {
    if (Array.isArray(tattoo.image)) return TattooStatus.NONE;
    if (page.includes(tattoo.image)) return TattooStatus.HAVE;
    if (haveOutfitPieces(tattoo.name)) return TattooStatus.HAVE_OUTFIT;
    return TattooStatus.NONE;
  }

  return getOutfitTattoos(loadTattoos()?.data || []).map(
    (tattoo) => [tattoo.outfit, getStatus(tattoo)] as RawOutfitTattoo
  );
}

function checkTattoos(tattoos: string) {
  return {
    outfitTattoos: checkOutfitTattoos(tattoos),
  };
}

function getPathLevel(path: PathDef) {
  if (path.points === null) return 0;
  return Math.min(
    (Array.isArray(path.points) ? path.points : [path.points])
      .map((k) => getNumber(k))
      .reduce((sum, v) => sum + v, 0),
    path.maxPoints
  );
}

function checkPaths(tattoos: string) {
  return (loadPaths()?.data ?? []).map((path) => {
    const level = getPathLevel(path);
    const items = path.items.map((i) =>
      haveItem(Item.get(i)) ? ItemStatus.HAVE : ItemStatus.NONE
    );
    const equipment = path.equipment.map((i) =>
      haveItem(Item.get(i)) ? ItemStatus.HAVE : ItemStatus.NONE
    );
    const tats = path.tattoos.map((tattoo) => {
      if (Array.isArray(tattoo.image)) {
        for (let i = tattoo.image.length - 1; i >= 0; i--) {
          if (tattoos.includes(tattoo.image[i])) {
            return i + 1;
          }
        }
        return 0;
      }

      return tattoos.includes(tattoo.image) ? 1 : 0;
    });

    return [path.id, level, items, equipment, tats] as RawPath;
  });
}

function checkMeta() {
  return {
    name: myName(),
    id: myId(),
    timestamp: new Date().getTime(),
    revision: getRevision(),
  };
}

function main(): void {
  printHtml(`Deciding your fate...`);

  if (inMultiFight() || handlingChoice() || currentRound() != 0) {
    printHtml(
      `<b><font color=red>You are in a combat or a choice adventure so your greenboxes will fail. Exiting...</font></b>`
    );
    return;
  }

  if (!getBoolean("kingLiberated")) {
    printHtml(
      `<b><font color=red>You are still in run so your greenboxes will probably be wrong</font></b>`
    );
  }

  const tattoos = visitUrl("account_tattoos.php");

  const code = compress({
    meta: checkMeta(),
    skills: checkSkills(),
    familiars: checkFamiliars(),
    trophies: checkTrophies(),
    ...checkTattoos(tattoos),
    paths: checkPaths(tattoos),
    iotms: checkIotMs(),
  });

  printHtml(
    `All done! To see your greenboxes, visit: <a href="https://greenbox.loathers.net/?d=${code}">https://greenbox.loathers.net/?d=${code}</a>`
  );
}

module.exports.main = main;
