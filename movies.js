// Marvel Studios (MCU) theatrical releases, in release order, through the
// most recent Spider-Man film. Non-MCU Marvel movies (Sony's Spider-Man
// Universe, Fox's X-Men/Fantastic Four, etc.) are intentionally excluded.
// `phase` groups movies in the pool and drives each chip's color accent.
const MARVEL_MOVIES = [
  // Phase 1
  { id: "iron-man", title: "Iron Man", year: 2008, phase: 1 },
  { id: "incredible-hulk", title: "The Incredible Hulk", year: 2008, phase: 1 },
  { id: "iron-man-2", title: "Iron Man 2", year: 2010, phase: 1 },
  { id: "thor", title: "Thor", year: 2011, phase: 1 },
  { id: "captain-america-first-avenger", title: "Captain America: The First Avenger", year: 2011, phase: 1 },
  { id: "avengers", title: "The Avengers", year: 2012, phase: 1 },
  // Phase 2
  { id: "iron-man-3", title: "Iron Man 3", year: 2013, phase: 2 },
  { id: "thor-dark-world", title: "Thor: The Dark World", year: 2013, phase: 2 },
  { id: "captain-america-winter-soldier", title: "Captain America: The Winter Soldier", year: 2014, phase: 2 },
  { id: "guardians-1", title: "Guardians of the Galaxy", year: 2014, phase: 2 },
  { id: "avengers-age-of-ultron", title: "Avengers: Age of Ultron", year: 2015, phase: 2 },
  { id: "ant-man", title: "Ant-Man", year: 2015, phase: 2 },
  // Phase 3
  { id: "captain-america-civil-war", title: "Captain America: Civil War", year: 2016, phase: 3 },
  { id: "doctor-strange", title: "Doctor Strange", year: 2016, phase: 3 },
  { id: "guardians-2", title: "Guardians of the Galaxy Vol. 2", year: 2017, phase: 3 },
  { id: "spider-man-homecoming", title: "Spider-Man: Homecoming", year: 2017, phase: 3 },
  { id: "thor-ragnarok", title: "Thor: Ragnarok", year: 2017, phase: 3 },
  { id: "black-panther", title: "Black Panther", year: 2018, phase: 3 },
  { id: "avengers-infinity-war", title: "Avengers: Infinity War", year: 2018, phase: 3 },
  { id: "ant-man-wasp", title: "Ant-Man and the Wasp", year: 2018, phase: 3 },
  { id: "captain-marvel", title: "Captain Marvel", year: 2019, phase: 3 },
  { id: "avengers-endgame", title: "Avengers: Endgame", year: 2019, phase: 3 },
  { id: "spider-man-far-from-home", title: "Spider-Man: Far From Home", year: 2019, phase: 3 },
  // Phase 4
  { id: "black-widow", title: "Black Widow", year: 2021, phase: 4 },
  { id: "shang-chi", title: "Shang-Chi and the Legend of the Ten Rings", year: 2021, phase: 4 },
  { id: "eternals", title: "Eternals", year: 2021, phase: 4 },
  { id: "spider-man-no-way-home", title: "Spider-Man: No Way Home", year: 2021, phase: 4 },
  { id: "doctor-strange-multiverse", title: "Doctor Strange in the Multiverse of Madness", year: 2022, phase: 4 },
  { id: "thor-love-thunder", title: "Thor: Love and Thunder", year: 2022, phase: 4 },
  { id: "black-panther-wakanda-forever", title: "Black Panther: Wakanda Forever", year: 2022, phase: 4 },
  // Phase 5
  { id: "ant-man-quantumania", title: "Ant-Man and the Wasp: Quantumania", year: 2023, phase: 5 },
  { id: "guardians-3", title: "Guardians of the Galaxy Vol. 3", year: 2023, phase: 5 },
  { id: "the-marvels", title: "The Marvels", year: 2023, phase: 5 },
  { id: "deadpool-wolverine", title: "Deadpool & Wolverine", year: 2024, phase: 5 },
  { id: "captain-america-brave-new-world", title: "Captain America: Brave New World", year: 2025, phase: 5 },
  { id: "thunderbolts", title: "Thunderbolts*", year: 2025, phase: 5 },
  // Phase 6
  { id: "fantastic-four-first-steps", title: "The Fantastic Four: First Steps", year: 2025, phase: 6 },
  { id: "spider-man-brand-new-day", title: "Spider-Man: Brand New Day", year: 2026, phase: 6 },
];

const PHASE_LABELS = {
  1: "Phase 1",
  2: "Phase 2",
  3: "Phase 3",
  4: "Phase 4",
  5: "Phase 5",
  6: "Phase 6",
};
