/* The one list of yes/no details a single can have (PeerMatch's quick details). Adding a new
   checkbox is one line here. Stored in person.facts under the same names PeerMatch used. */
export const FLAGS: [string, string][] = [
  ['divorced', 'Divorced'],
  ['withKids', 'With kids'],
  ['kosherForKohen', 'Kosher for Kohen'],
  ['kohen', 'Kohen'],
  ['baalTeshuvah', 'Baal teshuvah'],
  ['watchesMovies', 'Watches movies'],
  ['prays3Daily', 'Prays 3x daily'],
  ['smokes', 'Smokes']
];
export const LANGUAGES: [string, string][] = [['langEnglish', 'English'], ['langHebrew', 'Hebrew'], ['langRussian', 'Russian']];
export const BODY_TYPES: [string, string][] = [['regular', 'Regular'], ['overweight', 'Overweight']];
