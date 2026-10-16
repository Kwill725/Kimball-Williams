// Focus areas and a starter library of practice drills.

export const FOCUS_AREAS = [
  { id: "driving", label: "Driving" },
  { id: "irons", label: "Irons" },
  { id: "wedges", label: "Wedges" },
  { id: "chipping", label: "Chipping" },
  { id: "bunker", label: "Bunker" },
  { id: "putting", label: "Putting" },
  { id: "course", label: "On-Course" },
];

export const DRILLS = [
  {
    id: "fairway-gates",
    focus: "driving",
    name: "Fairway Gates",
    description: "Pick two targets ~30 yards apart as a fairway. Hit 10 drives and count how many finish between them.",
    minutes: 20,
  },
  {
    id: "alignment-sticks",
    focus: "irons",
    name: "Alignment Stick Ladder",
    description: "Lay a stick on your target line. Hit 5 balls each with 9-iron, 7-iron, and 5-iron, checking setup every shot.",
    minutes: 25,
  },
  {
    id: "clock-wedges",
    focus: "wedges",
    name: "Clock System",
    description: "Hit wedges with 9, 10, and 11 o'clock backswings. Note the carry distance of each to build your yardage chart.",
    minutes: 20,
  },
  {
    id: "landing-towel",
    focus: "chipping",
    name: "Landing Spot Towel",
    description: "Place a towel 3 yards onto the green. Chip 20 balls trying to land on the towel and let them release to the hole.",
    minutes: 15,
  },
  {
    id: "line-in-sand",
    focus: "bunker",
    name: "Line in the Sand",
    description: "Draw a line in the sand and practice entering the sand just behind it without a ball. Then add balls.",
    minutes: 15,
  },
  {
    id: "gate-putting",
    focus: "putting",
    name: "Tee Gate",
    description: "Place two tees slightly wider than your putter head. Make 20 strokes through the gate to train a square path.",
    minutes: 10,
  },
  {
    id: "circle-drill",
    focus: "putting",
    name: "3-Foot Circle",
    description: "Place 6 balls in a circle 3 ft from the hole. Make all 6 in a row before moving out to 4 ft.",
    minutes: 15,
  },
  {
    id: "worst-ball",
    focus: "course",
    name: "Worst Ball Scramble",
    description: "Play 3–9 holes hitting two balls each shot and always playing the worse one. Builds pressure and recovery skill.",
    minutes: 60,
  },
];

export function focusLabel(id) {
  return FOCUS_AREAS.find((f) => f.id === id)?.label ?? id;
}
