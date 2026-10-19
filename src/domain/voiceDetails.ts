/**
 * How the app shows Voice Details (see GLOSSARY.md). ElevenLabs gives some of them as
 * identifiers ("middle_aged", "narrative_story"), others as words ("latin american").
 */

/** A Voice Detail as the user reads it. */
export function detailLabel(value: string): string {
  return value.replace(/_/g, ' ');
}
