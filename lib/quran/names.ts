// The surah names as the organisers write them (their "Juzuu 30 za Qur'ani" sheet), shown in the
// app wherever a surah is named. Index 0 = surah 1. The Arabic names are in ./meta (SURAHS).
export const SURAH_NAMES: readonly string[] = [
  "Al-Fatiha", "Al-Baqarah", "Al-Imrani", "An-Nisa", "Al-Maidah", "Al-An'am", "Al-A'araf", "Al-Anfal", "At-Taubah", "Yunus",
  "Hud", "Yussuf", "Ar-Ra'ad", "Ibrahim", "Al-Hijri", "An-Nahl", "Al-Israi", "Al-Kahf", "Maryam", "Ta-Ha",
  "Al-Anbiyaa", "Al-Hajj", "Al-Muuminuun", "An-Nur", "Al-Furqan", "Ash-Shu'ara", "An-Naml", "Al-Qasas", "Al-Ankabut", "Ar-Rum",
  "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir", "Yassin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir",
  "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhani", "Al-Jathiya", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
  "Adh-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahmani", "Al-Waqiah", "Al-Hadid", "Al-Mujadalah", "Al-Hash'r", "Al-Mumtahanah",
  "As-Saff", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij",
  "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "Abasa",
  "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruuj", "At-Tariq", "Al-Ala", "Al-Ghashiyah", "Al-Fajr", "Al-Balad",
  "Ash-Shams", "Al-Layl", "Ad-Duha", "Al-Shar'h", "At-Tin", "Al-Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-Adiyat",
  "Al-Qari'ah", "At-Takathur", "Al-Asr", "Al-Humazah", "Al-Fiil", "Al-Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr",
  "Al-Masad", "Al-Ikh'las", "Al-Falaq", "An-Nas",
];

/** "Al-Baqarah" for 2. */
export const surahLabel = (surah: number) => SURAH_NAMES[surah - 1] ?? "";
