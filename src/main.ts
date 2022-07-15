import { Familiar, getPermedSkills, print, toInt, toSkill, visitUrl } from "kolmafia";
import { have } from "libram";

/**
 * Interface for the JSON output.
 */

export interface SnapshotOutput {
  hardcore?: number[];
  softcore?: number[];
  familiars?: number[];
  trophies?: number[];
}

/**
 * Generates an object with a list of HC & SC skill perms.
 * @returns large numeric list of skills, comma delimited, in two sections
 */
export function checkSkills(): SnapshotOutput {
  const skillsHCPermed = new Set<number>();
  const skillsSCPermed = new Set<number>();

  // Within getPermedSkills, the attached boolean represents HC/SC status.
  //   If the boolean is true, it's HC permed. False, SC permed.
  const permedSkills = getPermedSkills();

  // Checks permedSkills for HC/SC status and populates the two perm lists.
  for (const skillName in permedSkills) {
    permedSkills[skillName]
      ? skillsHCPermed.add(toInt(toSkill(skillName)))
      : skillsSCPermed.add(toInt(toSkill(skillName)));
  }

  // Place output in the desired interface format
  const skillOutput = {
    hardcore: Array.from(skillsHCPermed),
    softcore: Array.from(skillsSCPermed),
  };

  return skillOutput;
}

/** Generates an object with a list of familiars.
 * @returns large numeric list of familiars by fam ID
 */

export function checkFamiliars(): SnapshotOutput {
  const familiarsInTerrarium = new Set<number>();
  // const familiarHatchlings = new Set<number>();

  for (const fam of Familiar.all()) {
    if (have(fam)) familiarsInTerrarium.add(toInt(fam));
  }

  const famOutput = {
    familiars: Array.from(familiarsInTerrarium),
  };

  return famOutput;
}

/** Generates an object with a list of familiars.
 * @returns large numeric list of familiars by fam ID
 */

export function checkTrophies(): SnapshotOutput {
  const trophiesInCase = new Set<number>();
  const page = visitUrl("trophies.php");

  for (let x = 0; x <= 162; x++) {
    if (page.match(`"trophy${x}"`)) trophiesInCase.add(x);
  }
  const trophyOutput = {
    trophies: Array.from(trophiesInCase),
  };
  return trophyOutput;
}

export function main(): void {
  /**
   * Rev requested that the final data be staged as such:
   *
   * {
   * softcore:[skillid,skillid],
   * hardcore:[skillid,skillid],
   * familiar:[familiarid,familiarid],
   * }
   *
   */

  const greenboxOutput = {
    hardcore: checkSkills().hardcore,
    softcore: checkSkills().softcore,
    familiars: checkFamiliars().familiars,
    trophies: checkTrophies().trophies,
  };

  print(JSON.stringify(greenboxOutput));
}
