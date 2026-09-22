// Lightweight client-side profanity filter for Hall of Fame handles.
// Normalizes common leetspeak substitutions and collapses stretched letters
// (e.g. "sh1t", "fuuuck") before checking against a blocklist.

export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 15;

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

const BLOCKED_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'cunt',
  'nigg',
  'fagg',
  'retard',
  'whore',
  'dick',
  'pussy',
  'bastard',
  'slut',
  'rape',
  'nazi',
  'coon',
  'spic',
  'chink',
  'kike',
  'tranny',
  'twat',
];

function normalize(input: string): string {
  const substituted = input
    .toLowerCase()
    .split('')
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z]/g, '');
  // Collapse stretched-out letters ("fuuuck" -> "fuck") to catch obfuscation.
  return substituted.replace(/(.)\1+/g, '$1');
}

export function containsProfanity(input: string): boolean {
  const collapsed = normalize(input);
  const rawLetters = input.toLowerCase().replace(/[^a-z]/g, '');
  return BLOCKED_WORDS.some((word) => collapsed.includes(word) || rawLetters.includes(word));
}

export function validateHandle(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length < MIN_NAME_LENGTH || trimmed.length > MAX_NAME_LENGTH) {
    return `Name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters`;
  }
  if (!/^[a-zA-Z0-9 _.-]+$/.test(trimmed)) {
    return 'Only letters, numbers, spaces, and _ . - are allowed';
  }
  if (containsProfanity(trimmed)) {
    return 'Please choose an appropriate name';
  }
  return null;
}
