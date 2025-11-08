const PLOT_GRACE_COST = 400;
const GRACE_PER_LOGIN_SUB = 15;
const GRACE_PER_LOGIN_NON_SUB = 10;
const MAX_TIER_GOLD_COST = 18977310;

const FULL_PATH_SUB = [
    { level: 1, grace: 15, gold: 20 },
    { level: 2, grace: 30, gold: 50 },
    { level: 3, grace: 45, gold: 90 },
    { level: 4, grace: 60, gold: 140 },
    { level: 5, grace: 75, gold: 210 },
    { level: 6, grace: 90, gold: 360 },
    { level: 7, grace: 105, gold: 660 },
    { level: 8, grace: 120, gold: 1110 },
    { level: 9, grace: 135, gold: 1710 },
    { level: 10, grace: 150, gold: 2910 },
    { level: 11, grace: 165, gold: 5310 },
    { level: 12, grace: 180, gold: 10310 },
    { level: 13, grace: 195, gold: 18310 },
    { level: 24, grace: 360, gold: MAX_TIER_GOLD_COST }
];

const FULL_PATH_NON_SUB = [
    { level: 1, grace: 10, gold: 20 },
    { level: 2, grace: 20, gold: 50 },
    { level: 3, grace: 30, gold: 90 },
    { level: 4, grace: 40, gold: 140 },
    { level: 5, grace: 50, gold: 210 },
    { level: 6, grace: 60, gold: 360 },
    { level: 7, grace: 70, gold: 660 },
    { level: 8, grace: 80, gold: 1110 },
    { level: 9, grace: 90, gold: 1710 },
    { level: 10, grace: 100, gold: 2910 },
    { level: 11, grace: 110, gold: 5310 },
    { level: 12, grace: 120, gold: 10310 },
    { level: 13, grace: 130, gold: 18310 },
    { level: 24, grace: 240, gold: MAX_TIER_GOLD_COST }
];

const OPTIMIZED_BASE_SCENARIOS_SUB = {
    2: { steps: [{ grace: 195, gold: 18310, level: 13, day: 1 }, { grace: 180, gold: 10310, level: 12, day: 2 }], totalGrace: 375, totalGold: 28620, deficit: 370 },
    3: { steps: [{ grace: 150, gold: 2910, level: 10, day: 1 }, { grace: 150, gold: 2910, level: 10, day: 2 }, { grace: 60, gold: 140, level: 4, day: 3 }], totalGrace: 360, totalGold: 5960, deficit: 355 },
    4: { steps: [{ grace: 90, gold: 360, level: 6, day: 1 }, { grace: 90, gold: 360, level: 6, day: 2 }, { grace: 90, gold: 360, level: 6, day: 3 }, { grace: 75, gold: 210, level: 5, day: 4 }], totalGrace: 345, totalGold: 1290, deficit: 340 },
    5: { steps: [{ grace: 90, gold: 360, level: 6, day: 1 }, { grace: 90, gold: 360, level: 6, day: 2 }, { grace: 90, gold: 360, level: 6, day: 3 }, { grace: 45, gold: 90, level: 3, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }], totalGrace: 330, totalGold: 1190, deficit: 325 },
    6: { steps: [{ grace: 60, gold: 140, level: 4, day: 1 }, { grace: 60, gold: 140, level: 4, day: 2 }, { grace: 60, gold: 140, level: 4, day: 3 }, { grace: 60, gold: 140, level: 4, day: 4 }, { grace: 60, gold: 140, level: 4, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }], totalGrace: 315, totalGold: 720, deficit: 310 },
    7: { steps: [{ grace: 60, gold: 140, level: 4, day: 1 }, { grace: 60, gold: 140, level: 4, day: 2 }, { grace: 45, gold: 90, level: 3, day: 3 }, { grace: 45, gold: 90, level: 3, day: 4 }, { grace: 30, gold: 50, level: 2, day: 5 }, { grace: 30, gold: 50, level: 2, day: 6 }, { grace: 30, gold: 50, level: 2, day: 7 }], totalGrace: 300, totalGold: 610, deficit: 295 },
    8: { steps: [{ grace: 45, gold: 90, level: 3, day: 1 }, { grace: 45, gold: 90, level: 3, day: 2 }, { grace: 45, gold: 90, level: 3, day: 3 }, { grace: 45, gold: 90, level: 3, day: 4 }, { grace: 30, gold: 50, level: 2, day: 5 }, { grace: 30, gold: 50, level: 2, day: 6 }, { grace: 30, gold: 50, level: 2, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }], totalGrace: 285, totalGold: 530, deficit: 280 },
    9: { steps: [{ grace: 30, gold: 50, level: 2, day: 1 }, { grace: 30, gold: 50, level: 2, day: 2 }, { grace: 30, gold: 50, level: 2, day: 3 }, { grace: 30, gold: 50, level: 2, day: 4 }, { grace: 30, gold: 50, level: 2, day: 5 }, { grace: 30, gold: 50, level: 2, day: 6 }, { grace: 30, gold: 50, level: 2, day: 7 }, { grace: 30, gold: 50, level: 2, day: 8 }, { grace: 30, gold: 50, level: 2, day: 9 }], totalGrace: 270, totalGold: 450, deficit: 265 },
    10: { steps: [{ grace: 30, gold: 50, level: 2, day: 1 }, { grace: 30, gold: 50, level: 2, day: 2 }, { grace: 30, gold: 50, level: 2, day: 3 }, { grace: 30, gold: 50, level: 2, day: 4 }, { grace: 30, gold: 50, level: 2, day: 5 }, { grace: 30, gold: 50, level: 2, day: 6 }, { grace: 30, gold: 50, level: 2, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }, { grace: 15, gold: 20, level: 1, day: 9 }, { grace: 15, gold: 20, level: 1, day: 10 }], totalGrace: 255, totalGold: 410, deficit: 250 },
    11: { steps: [{ grace: 30, gold: 50, level: 2, day: 1 }, { grace: 30, gold: 50, level: 2, day: 2 }, { grace: 30, gold: 50, level: 2, day: 3 }, { grace: 30, gold: 50, level: 2, day: 4 }, { grace: 30, gold: 50, level: 2, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 15, gold: 20, level: 1, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }, { grace: 15, gold: 20, level: 1, day: 9 }, { grace: 15, gold: 20, level: 1, day: 10 }, { grace: 15, gold: 20, level: 1, day: 11 }], totalGrace: 240, totalGold: 370, deficit: 235 },
    12: { steps: [{ grace: 30, gold: 50, level: 2, day: 1 }, { grace: 30, gold: 50, level: 2, day: 2 }, { grace: 30, gold: 50, level: 2, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 15, gold: 20, level: 1, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }, { grace: 15, gold: 20, level: 1, day: 9 }, { grace: 15, gold: 20, level: 1, day: 10 }, { grace: 15, gold: 20, level: 1, day: 11 }, { grace: 15, gold: 20, level: 1, day: 12 }], totalGrace: 225, totalGold: 330, deficit: 220 },
    13: { steps: [{ grace: 30, gold: 50, level: 2, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 15, gold: 20, level: 1, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }, { grace: 15, gold: 20, level: 1, day: 9 }, { grace: 15, gold: 20, level: 1, day: 10 }, { grace: 15, gold: 20, level: 1, day: 11 }, { grace: 15, gold: 20, level: 1, day: 12 }, { grace: 15, gold: 20, level: 1, day: 13 }], totalGrace: 210, totalGold: 290, deficit: 205 },
    14: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 15, gold: 20, level: 1, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }, { grace: 15, gold: 20, level: 1, day: 9 }, { grace: 15, gold: 20, level: 1, day: 10 }, { grace: 15, gold: 20, level: 1, day: 11 }, { grace: 15, gold: 20, level: 1, day: 12 }, { grace: 15, gold: 20, level: 1, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }], totalGrace: 195, totalGold: 260, deficit: 190 },
    15: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 15, gold: 20, level: 1, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }, { grace: 15, gold: 20, level: 1, day: 9 }, { grace: 15, gold: 20, level: 1, day: 10 }, { grace: 15, gold: 20, level: 1, day: 11 }, { grace: 15, gold: 20, level: 1, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }], totalGrace: 180, totalGold: 240, deficit: 175 },
    16: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 15, gold: 20, level: 1, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }, { grace: 15, gold: 20, level: 1, day: 9 }, { grace: 15, gold: 20, level: 1, day: 10 }, { grace: 15, gold: 20, level: 1, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }], totalGrace: 165, totalGold: 220, deficit: 160 },
    17: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 15, gold: 20, level: 1, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }, { grace: 15, gold: 20, level: 1, day: 9 }, { grace: 15, gold: 20, level: 1, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }], totalGrace: 150, totalGold: 200, deficit: 145 },
    18: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 15, gold: 20, level: 1, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }, { grace: 15, gold: 20, level: 1, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }], totalGrace: 135, totalGold: 180, deficit: 130 },
    19: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 15, gold: 20, level: 1, day: 7 }, { grace: 15, gold: 20, level: 1, day: 8 }, { grace: 0, gold: 0, level: 0, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }], totalGrace: 120, totalGold: 160, deficit: 115 },
    20: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 15, gold: 20, level: 1, day: 7 }, { grace: 0, gold: 0, level: 0, day: 8 }, { grace: 0, gold: 0, level: 0, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }], totalGrace: 105, totalGold: 140, deficit: 100 },
    21: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 15, gold: 20, level: 1, day: 6 }, { grace: 0, gold: 0, level: 0, day: 7 }, { grace: 0, gold: 0, level: 0, day: 8 }, { grace: 0, gold: 0, level: 0, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }], totalGrace: 90, totalGold: 120, deficit: 85 },
    22: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 15, gold: 20, level: 1, day: 5 }, { grace: 0, gold: 0, level: 0, day: 6 }, { grace: 0, gold: 0, level: 0, day: 7 }, { grace: 0, gold: 0, level: 0, day: 8 }, { grace: 0, gold: 0, level: 0, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }], totalGrace: 75, totalGold: 100, deficit: 70 },
    23: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 15, gold: 20, level: 1, day: 4 }, { grace: 0, gold: 0, level: 0, day: 5 }, { grace: 0, gold: 0, level: 0, day: 6 }, { grace: 0, gold: 0, level: 0, day: 7 }, { grace: 0, gold: 0, level: 0, day: 8 }, { grace: 0, gold: 0, level: 0, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }], totalGrace: 60, totalGold: 80, deficit: 55 },
    24: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 15, gold: 20, level: 1, day: 3 }, { grace: 0, gold: 0, level: 0, day: 4 }, { grace: 0, gold: 0, level: 0, day: 5 }, { grace: 0, gold: 0, level: 0, day: 6 }, { grace: 0, gold: 0, level: 0, day: 7 }, { grace: 0, gold: 0, level: 0, day: 8 }, { grace: 0, gold: 0, level: 0, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }, { grace: 0, gold: 0, level: 0, day: 24 }], totalGrace: 45, totalGold: 60, deficit: 40 },
    25: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 15, gold: 20, level: 1, day: 2 }, { grace: 0, gold: 0, level: 0, day: 3 }, { grace: 0, gold: 0, level: 0, day: 4 }, { grace: 0, gold: 0, level: 0, day: 5 }, { grace: 0, gold: 0, level: 0, day: 6 }, { grace: 0, gold: 0, level: 0, day: 7 }, { grace: 0, gold: 0, level: 0, day: 8 }, { grace: 0, gold: 0, level: 0, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }, { grace: 0, gold: 0, level: 0, day: 24 }, { grace: 0, gold: 0, level: 0, day: 25 }], totalGrace: 30, totalGold: 40, deficit: 25 },
    26: { steps: [{ grace: 15, gold: 20, level: 1, day: 1 }, { grace: 0, gold: 0, level: 0, day: 2 }, { grace: 0, gold: 0, level: 0, day: 3 }, { grace: 0, gold: 0, level: 0, day: 4 }, { grace: 0, gold: 0, level: 0, day: 5 }, { grace: 0, gold: 0, level: 0, day: 6 }, { grace: 0, gold: 0, level: 0, day: 7 }, { grace: 0, gold: 0, level: 0, day: 8 }, { grace: 0, gold: 0, level: 0, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }, { grace: 0, gold: 0, level: 0, day: 24 }, { grace: 0, gold: 0, level: 0, day: 25 }, { grace: 0, gold: 0, level: 0, day: 26 }], totalGrace: 15, totalGold: 20, deficit: 10 },
    27: { steps: [{ grace: 0, gold: 0, level: 0, day: 1 }, { grace: 0, gold: 0, level: 0, day: 2 }, { grace: 0, gold: 0, level: 0, day: 3 }, { grace: 0, gold: 0, level: 0, day: 4 }, { grace: 0, gold: 0, level: 0, day: 5 }, { grace: 0, gold: 0, level: 0, day: 6 }, { grace: 0, gold: 0, level: 0, day: 7 }, { grace: 0, gold: 0, level: 0, day: 8 }, { grace: 0, gold: 0, level: 0, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }, { grace: 0, gold: 0, level: 0, day: 24 }, { grace: 0, gold: 0, level: 0, day: 25 }, { grace: 0, gold: 0, level: 0, day: 26 }, { grace: 0, gold: 0, level: 0, day: 27 }], totalGrace: 0, totalGold: 0, deficit: 0 },
    28: { steps: [{ grace: 0, gold: 0, level: 0, day: 1 }, { grace: 0, gold: 0, level: 0, day: 2 }, { grace: 0, gold: 0, level: 0, day: 3 }, { grace: 0, gold: 0, level: 0, day: 4 }, { grace: 0, gold: 0, level: 0, day: 5 }, { grace: 0, gold: 0, level: 0, day: 6 }, { grace: 0, gold: 0, level: 0, day: 7 }, { grace: 0, gold: 0, level: 0, day: 8 }, { grace: 0, gold: 0, level: 0, day: 9 }, { grace: 0, gold: 0, level: 0, day: 10 }, { grace: 0, gold: 0, level: 0, day: 11 }, { grace: 0, gold: 0, level: 0, day: 12 }, { grace: 0, gold: 0, level: 0, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }, { grace: 0, gold: 0, level: 0, day: 24 }, { grace: 0, gold: 0, level: 0, day: 25 }, { grace: 0, gold: 0, level: 0, day: 26 }, { grace: 0, gold: 0, level: 0, day: 27 }, { grace: 0, gold: 0, level: 0, day: 28 }], totalGrace: 0, totalGold: 0, deficit: 0 }
};

const OPTIMIZED_BASE_SCENARIOS_NON_SUB = {
    2: { steps: [{ grace: 190, gold: 737310, level: 23, day: 1 }, { grace: 190, gold: 737310, level: 23, day: 2 }], totalGrace: 380, totalGold: 1474620, deficit: 380 },
    3: { steps: [{ grace: 130, gold: 18310, level: 13, day: 1 }, { grace: 120, gold: 10310, level: 12, day: 2 }, { grace: 120, gold: 10310, level: 12, day: 3 }], totalGrace: 370, totalGold: 38930, deficit: 370 },
    4: { steps: [{ grace: 90, gold: 1710, level: 9, day: 1 }, { grace: 90, gold: 1710, level: 9, day: 2 }, { grace: 90, gold: 1710, level: 9, day: 3 }, { grace: 90, gold: 1710, level: 9, day: 4 }], totalGrace: 360, totalGold: 6840, deficit: 360 },
    5: { steps: [{ grace: 70, gold: 660, level: 7, day: 1 }, { grace: 70, gold: 660, level: 7, day: 2 }, { grace: 70, gold: 660, level: 7, day: 3 }, { grace: 70, gold: 660, level: 7, day: 4 }, { grace: 70, gold: 660, level: 7, day: 5 }], totalGrace: 350, totalGold: 3300, deficit: 350 },
    6: { steps: [{ grace: 60, gold: 360, level: 6, day: 1 }, { grace: 60, gold: 360, level: 6, day: 2 }, { grace: 60, gold: 360, level: 6, day: 3 }, { grace: 60, gold: 360, level: 6, day: 4 }, { grace: 50, gold: 210, level: 5, day: 5 }, { grace: 50, gold: 210, level: 5, day: 6 }], totalGrace: 340, totalGold: 1860, deficit: 340 },
    7: { steps: [{ grace: 50, gold: 210, level: 5, day: 1 }, { grace: 50, gold: 210, level: 5, day: 2 }, { grace: 50, gold: 210, level: 5, day: 3 }, { grace: 50, gold: 210, level: 5, day: 4 }, { grace: 50, gold: 210, level: 5, day: 5 }, { grace: 50, gold: 210, level: 5, day: 6 }, { grace: 30, gold: 90, level: 3, day: 7 }], totalGrace: 330, totalGold: 1350, deficit: 330 },
    8: { steps: [{ grace: 50, gold: 210, level: 5, day: 1 }, { grace: 50, gold: 210, level: 5, day: 2 }, { grace: 50, gold: 210, level: 5, day: 3 }, { grace: 50, gold: 210, level: 5, day: 4 }, { grace: 30, gold: 90, level: 3, day: 5 }, { grace: 30, gold: 90, level: 3, day: 6 }, { grace: 30, gold: 90, level: 3, day: 7 }, { grace: 30, gold: 90, level: 3, day: 8 }], totalGrace: 320, totalGold: 1200, deficit: 320 },
    9: { steps: [{ grace: 40, gold: 140, level: 4, day: 1 }, { grace: 40, gold: 140, level: 4, day: 2 }, { grace: 40, gold: 140, level: 4, day: 3 }, { grace: 40, gold: 140, level: 4, day: 4 }, { grace: 30, gold: 90, level: 3, day: 5 }, { grace: 30, gold: 90, level: 3, day: 6 }, { grace: 30, gold: 90, level: 3, day: 7 }, { grace: 30, gold: 90, level: 3, day: 8 }, { grace: 30, gold: 90, level: 3, day: 9 }], totalGrace: 310, totalGold: 1010, deficit: 310 },
    10: { steps: [{ grace: 30, gold: 90, level: 3, day: 1 }, { grace: 30, gold: 90, level: 3, day: 2 }, { grace: 30, gold: 90, level: 3, day: 3 }, { grace: 30, gold: 90, level: 3, day: 4 }, { grace: 30, gold: 90, level: 3, day: 5 }, { grace: 30, gold: 90, level: 3, day: 6 }, { grace: 30, gold: 90, level: 3, day: 7 }, { grace: 30, gold: 90, level: 3, day: 8 }, { grace: 30, gold: 90, level: 3, day: 9 }, { grace: 30, gold: 90, level: 3, day: 10 }], totalGrace: 300, totalGold: 900, deficit: 300 },
    11: { steps: [{ grace: 30, gold: 90, level: 3, day: 1 }, { grace: 30, gold: 90, level: 3, day: 2 }, { grace: 30, gold: 90, level: 3, day: 3 }, { grace: 30, gold: 90, level: 3, day: 4 }, { grace: 30, gold: 90, level: 3, day: 5 }, { grace: 30, gold: 90, level: 3, day: 6 }, { grace: 30, gold: 90, level: 3, day: 7 }, { grace: 20, gold: 50, level: 2, day: 8 }, { grace: 20, gold: 50, level: 2, day: 9 }, { grace: 20, gold: 50, level: 2, day: 10 }, { grace: 20, gold: 50, level: 2, day: 11 }], totalGrace: 290, totalGold: 830, deficit: 290 },
    12: { steps: [{ grace: 30, gold: 90, level: 3, day: 1 }, { grace: 30, gold: 90, level: 3, day: 2 }, { grace: 30, gold: 90, level: 3, day: 3 }, { grace: 30, gold: 90, level: 3, day: 4 }, { grace: 20, gold: 50, level: 2, day: 5 }, { grace: 20, gold: 50, level: 2, day: 6 }, { grace: 20, gold: 50, level: 2, day: 7 }, { grace: 20, gold: 50, level: 2, day: 8 }, { grace: 20, gold: 50, level: 2, day: 9 }, { grace: 20, gold: 50, level: 2, day: 10 }, { grace: 20, gold: 50, level: 2, day: 11 }, { grace: 20, gold: 50, level: 2, day: 12 }], totalGrace: 280, totalGold: 760, deficit: 280 },
    13: { steps: [{ grace: 30, gold: 90, level: 3, day: 1 }, { grace: 20, gold: 50, level: 2, day: 2 }, { grace: 20, gold: 50, level: 2, day: 3 }, { grace: 20, gold: 50, level: 2, day: 4 }, { grace: 20, gold: 50, level: 2, day: 5 }, { grace: 20, gold: 50, level: 2, day: 6 }, { grace: 20, gold: 50, level: 2, day: 7 }, { grace: 20, gold: 50, level: 2, day: 8 }, { grace: 20, gold: 50, level: 2, day: 9 }, { grace: 20, gold: 50, level: 2, day: 10 }, { grace: 20, gold: 50, level: 2, day: 11 }, { grace: 20, gold: 50, level: 2, day: 12 }, { grace: 20, gold: 50, level: 2, day: 13 }], totalGrace: 270, totalGold: 690, deficit: 270 },
    14: { steps: [{ grace: 20, gold: 50, level: 2, day: 1 }, { grace: 20, gold: 50, level: 2, day: 2 }, { grace: 20, gold: 50, level: 2, day: 3 }, { grace: 20, gold: 50, level: 2, day: 4 }, { grace: 20, gold: 50, level: 2, day: 5 }, { grace: 20, gold: 50, level: 2, day: 6 }, { grace: 20, gold: 50, level: 2, day: 7 }, { grace: 20, gold: 50, level: 2, day: 8 }, { grace: 20, gold: 50, level: 2, day: 9 }, { grace: 20, gold: 50, level: 2, day: 10 }, { grace: 20, gold: 50, level: 2, day: 11 }, { grace: 20, gold: 50, level: 2, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }], totalGrace: 260, totalGold: 640, deficit: 260 },
    15: { steps: [{ grace: 20, gold: 50, level: 2, day: 1 }, { grace: 20, gold: 50, level: 2, day: 2 }, { grace: 20, gold: 50, level: 2, day: 3 }, { grace: 20, gold: 50, level: 2, day: 4 }, { grace: 20, gold: 50, level: 2, day: 5 }, { grace: 20, gold: 50, level: 2, day: 6 }, { grace: 20, gold: 50, level: 2, day: 7 }, { grace: 20, gold: 50, level: 2, day: 8 }, { grace: 20, gold: 50, level: 2, day: 9 }, { grace: 20, gold: 50, level: 2, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }], totalGrace: 250, totalGold: 600, deficit: 250 },
    16: { steps: [{ grace: 20, gold: 50, level: 2, day: 1 }, { grace: 20, gold: 50, level: 2, day: 2 }, { grace: 20, gold: 50, level: 2, day: 3 }, { grace: 20, gold: 50, level: 2, day: 4 }, { grace: 20, gold: 50, level: 2, day: 5 }, { grace: 20, gold: 50, level: 2, day: 6 }, { grace: 20, gold: 50, level: 2, day: 7 }, { grace: 20, gold: 50, level: 2, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }, { grace: 10, gold: 20, level: 1, day: 16 }], totalGrace: 240, totalGold: 560, deficit: 240 },
    17: { steps: [{ grace: 20, gold: 50, level: 2, day: 1 }, { grace: 20, gold: 50, level: 2, day: 2 }, { grace: 20, gold: 50, level: 2, day: 3 }, { grace: 20, gold: 50, level: 2, day: 4 }, { grace: 20, gold: 50, level: 2, day: 5 }, { grace: 20, gold: 50, level: 2, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }, { grace: 10, gold: 20, level: 1, day: 16 }, { grace: 10, gold: 20, level: 1, day: 17 }], totalGrace: 230, totalGold: 520, deficit: 230 },
    18: { steps: [{ grace: 20, gold: 50, level: 2, day: 1 }, { grace: 20, gold: 50, level: 2, day: 2 }, { grace: 20, gold: 50, level: 2, day: 3 }, { grace: 20, gold: 50, level: 2, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }, { grace: 10, gold: 20, level: 1, day: 16 }, { grace: 10, gold: 20, level: 1, day: 17 }, { grace: 10, gold: 20, level: 1, day: 18 }], totalGrace: 220, totalGold: 480, deficit: 220 },
    19: { steps: [{ grace: 20, gold: 50, level: 2, day: 1 }, { grace: 20, gold: 50, level: 2, day: 2 }, { grace: 10, gold: 20, level: 1, day: 3 }, { grace: 10, gold: 20, level: 1, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }, { grace: 10, gold: 20, level: 1, day: 16 }, { grace: 10, gold: 20, level: 1, day: 17 }, { grace: 10, gold: 20, level: 1, day: 18 }, { grace: 10, gold: 20, level: 1, day: 19 }], totalGrace: 210, totalGold: 440, deficit: 210 },
    20: { steps: [{ grace: 10, gold: 20, level: 1, day: 1 }, { grace: 10, gold: 20, level: 1, day: 2 }, { grace: 10, gold: 20, level: 1, day: 3 }, { grace: 10, gold: 20, level: 1, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }, { grace: 10, gold: 20, level: 1, day: 16 }, { grace: 10, gold: 20, level: 1, day: 17 }, { grace: 10, gold: 20, level: 1, day: 18 }, { grace: 10, gold: 20, level: 1, day: 19 }, { grace: 10, gold: 20, level: 1, day: 20 }], totalGrace: 200, totalGold: 400, deficit: 200 },
    21: { steps: [{ grace: 10, gold: 20, level: 1, day: 1 }, { grace: 10, gold: 20, level: 1, day: 2 }, { grace: 10, gold: 20, level: 1, day: 3 }, { grace: 10, gold: 20, level: 1, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }, { grace: 10, gold: 20, level: 1, day: 16 }, { grace: 10, gold: 20, level: 1, day: 17 }, { grace: 10, gold: 20, level: 1, day: 18 }, { grace: 10, gold: 20, level: 1, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }], totalGrace: 190, totalGold: 380, deficit: 190 },
    22: { steps: [{ grace: 10, gold: 20, level: 1, day: 1 }, { grace: 10, gold: 20, level: 1, day: 2 }, { grace: 10, gold: 20, level: 1, day: 3 }, { grace: 10, gold: 20, level: 1, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }, { grace: 10, gold: 20, level: 1, day: 16 }, { grace: 10, gold: 20, level: 1, day: 17 }, { grace: 10, gold: 20, level: 1, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }], totalGrace: 180, totalGold: 360, deficit: 180 },
    23: { steps: [{ grace: 10, gold: 20, level: 1, day: 1 }, { grace: 10, gold: 20, level: 1, day: 2 }, { grace: 10, gold: 20, level: 1, day: 3 }, { grace: 10, gold: 20, level: 1, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }, { grace: 10, gold: 20, level: 1, day: 16 }, { grace: 10, gold: 20, level: 1, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }], totalGrace: 170, totalGold: 340, deficit: 170 },
    24: { steps: [{ grace: 10, gold: 20, level: 1, day: 1 }, { grace: 10, gold: 20, level: 1, day: 2 }, { grace: 10, gold: 20, level: 1, day: 3 }, { grace: 10, gold: 20, level: 1, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }, { grace: 10, gold: 20, level: 1, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }, { grace: 0, gold: 0, level: 0, day: 24 }], totalGrace: 160, totalGold: 320, deficit: 160 },
    25: { steps: [{ grace: 10, gold: 20, level: 1, day: 1 }, { grace: 10, gold: 20, level: 1, day: 2 }, { grace: 10, gold: 20, level: 1, day: 3 }, { grace: 10, gold: 20, level: 1, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 10, gold: 20, level: 1, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }, { grace: 0, gold: 0, level: 0, day: 24 }, { grace: 0, gold: 0, level: 0, day: 25 }], totalGrace: 150, totalGold: 300, deficit: 150 },
    26: { steps: [{ grace: 10, gold: 20, level: 1, day: 1 }, { grace: 10, gold: 20, level: 1, day: 2 }, { grace: 10, gold: 20, level: 1, day: 3 }, { grace: 10, gold: 20, level: 1, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 10, gold: 20, level: 1, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }, { grace: 0, gold: 0, level: 0, day: 24 }, { grace: 0, gold: 0, level: 0, day: 25 }, { grace: 0, gold: 0, level: 0, day: 26 }], totalGrace: 140, totalGold: 280, deficit: 140 },
    27: { steps: [{ grace: 10, gold: 20, level: 1, day: 1 }, { grace: 10, gold: 20, level: 1, day: 2 }, { grace: 10, gold: 20, level: 1, day: 3 }, { grace: 10, gold: 20, level: 1, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }, { grace: 0, gold: 0, level: 0, day: 24 }, { grace: 0, gold: 0, level: 0, day: 25 }, { grace: 0, gold: 0, level: 0, day: 26 }, { grace: 0, gold: 0, level: 0, day: 27 }], totalGrace: 130, totalGold: 260, deficit: 130 },
    28: { steps: [{ grace: 10, gold: 20, level: 1, day: 1 }, { grace: 10, gold: 20, level: 1, day: 2 }, { grace: 10, gold: 20, level: 1, day: 3 }, { grace: 10, gold: 20, level: 1, day: 4 }, { grace: 10, gold: 20, level: 1, day: 5 }, { grace: 10, gold: 20, level: 1, day: 6 }, { grace: 10, gold: 20, level: 1, day: 7 }, { grace: 10, gold: 20, level: 1, day: 8 }, { grace: 10, gold: 20, level: 1, day: 9 }, { grace: 10, gold: 20, level: 1, day: 10 }, { grace: 10, gold: 20, level: 1, day: 11 }, { grace: 10, gold: 20, level: 1, day: 12 }, { grace: 10, gold: 20, level: 1, day: 13 }, { grace: 0, gold: 0, level: 0, day: 14 }, { grace: 0, gold: 0, level: 0, day: 15 }, { grace: 0, gold: 0, level: 0, day: 16 }, { grace: 0, gold: 0, level: 0, day: 17 }, { grace: 0, gold: 0, level: 0, day: 18 }, { grace: 0, gold: 0, level: 0, day: 19 }, { grace: 0, gold: 0, level: 0, day: 20 }, { grace: 0, gold: 0, level: 0, day: 21 }, { grace: 0, gold: 0, level: 0, day: 22 }, { grace: 0, gold: 0, level: 0, day: 23 }, { grace: 0, gold: 0, level: 0, day: 24 }, { grace: 0, gold: 0, level: 0, day: 25 }, { grace: 0, gold: 0, level: 0, day: 26 }, { grace: 0, gold: 0, level: 0, day: 27 }, { grace: 0, gold: 0, level: 0, day: 28 }], totalGrace: 130, totalGold: 260, deficit: 120 }
};


let isSubscribed = true;

function getTierForGrace(targetGrace, fullPath) {
    const tier = fullPath.find(t => t.grace >= targetGrace);
    return tier || fullPath[fullPath.length - 1];
}

function calculateGoldCostIgnoringLogins(neededGrace) {
    if (neededGrace <= 0) return 0;
    const fullPath = isSubscribed ? FULL_PATH_SUB : FULL_PATH_NON_SUB;
    const requiredTier = fullPath.find(t => t.grace >= neededGrace);
    return requiredTier ? requiredTier.gold : MAX_TIER_GOLD_COST;
}

function calculatePurchaseBreakdown(neededGrace, maxLogins, existingGrace) {
    if (neededGrace <= 0) return { steps: [], totalGold: 0, totalGracePurchased: 0, finalDeficit: 0 };
    
    const baseScenarios = isSubscribed ? OPTIMIZED_BASE_SCENARIOS_SUB : OPTIMIZED_BASE_SCENARIOS_NON_SUB;
    const fullPath = isSubscribed ? FULL_PATH_SUB : FULL_PATH_NON_SUB;

    if (!baseScenarios[maxLogins]) {
        if (maxLogins === 1) {
             const tier = fullPath[fullPath.length - 1];
             return {
                 steps: [{ grace: tier.grace, gold: tier.gold, level: tier.level, day: 1 }],
                 totalGrace: tier.grace,
                 totalGold: tier.gold,
                 finalDeficit: Math.max(0, neededGrace - tier.grace)
             };
        }
        return { steps: [], totalGold: 0, totalGracePurchased: 0, finalDeficit: neededGrace };
    }

    const baseScenario = baseScenarios[maxLogins];
    let currentGraceNeeded = neededGrace;
    let newSteps = [];
    let totalGold = 0;
    let totalGracePurchased = 0;

    for (let i = 0; i < baseScenario.steps.length; i++) {
        const baseStep = baseScenario.steps[i];

        if (currentGraceNeeded <= 0) break;

        let actualPurchase = baseStep;

        if (actualPurchase.grace > currentGraceNeeded) {
            actualPurchase = getTierForGrace(currentGraceNeeded, fullPath);
        }

        if (actualPurchase.grace > 0) {
            newSteps.push({ ...actualPurchase, day: i + 1 });
            totalGracePurchased += actualPurchase.grace;
            totalGold += actualPurchase.gold;
            currentGraceNeeded -= actualPurchase.grace;
        } else if (actualPurchase.grace === 0 && actualPurchase.gold === 0) {
            newSteps.push({ ...actualPurchase, day: i + 1 });
        }
    }

    const finalDeficit = Math.max(0, neededGrace - totalGracePurchased);
    return { steps: newSteps, totalGold: totalGold, totalGracePurchased: totalGracePurchased, finalDeficit: finalDeficit };
}

function populateGraceTable() {
    const tbody = document.getElementById('graceTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const initialTiers = isSubscribed ? FULL_PATH_SUB.slice(0, 6) : FULL_PATH_NON_SUB.slice(0, 6);
    initialTiers.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-700 transition-colors duration-150';
        let tdLevel = document.createElement('td');
        tdLevel.className = 'px-6 py-4 whitespace-nowrap font-medium text-white';
        tdLevel.textContent = row.level.toLocaleString();
        tr.appendChild(tdLevel);
        let tdGold = document.createElement('td');
        tdGold.className = 'px-6 py-4 whitespace-nowrap font-medium text-yellow-400';
        tdGold.textContent = row.gold.toLocaleString();
        tr.appendChild(tdGold);
        let tdGrace = document.createElement('td');
        tdGrace.className = 'px-6 py-4 whitespace-nowrap text-green-400';
        tdGrace.textContent = row.grace.toLocaleString();
        tr.appendChild(tdGrace);
        tbody.appendChild(tr);
    });
}

function setPlayerType(type) {
    isSubscribed = (type === 'sub');
    const subBtn = document.getElementById('subBtn');
    const nonSubBtn = document.getElementById('nonSubBtn');
    const activeClasses = ['bg-indigo-500', 'text-white'];
    const inactiveClasses = ['text-gray-300', 'hover:bg-gray-600'];
    subBtn.classList.remove(...activeClasses);
    subBtn.classList.add(...inactiveClasses);
    nonSubBtn.classList.remove(...activeClasses);
    nonSubBtn.classList.add(...inactiveClasses);
    if (isSubscribed) {
        subBtn.classList.add(...activeClasses);
        subBtn.classList.remove(...inactiveClasses);
    } else {
        nonSubBtn.classList.add(...activeClasses);
        nonSubBtn.classList.remove(...inactiveClasses);
    }
    populateGraceTable();
    calculateGrace();
}

function updateLoginsValue(value) {
    document.getElementById('loginsValue').textContent = value;
}

function recommendPurchase(neededGrace, currentGold, breakdown) {
    if (neededGrace <= 0) return { requiredGold: 0, message: `🎉 Goal Achieved! You have ${Math.abs(neededGrace).toLocaleString()} Grace surplus for the plot (from existing Grace/logins alone).` };
    
    const requiredCumulativeGrace = neededGrace;
    const totalGoldCostSequential = calculateGoldCostIgnoringLogins(requiredCumulativeGrace);
    
    const totalGracePurchased = breakdown.totalGracePurchased;
    const deficitRemaining = Math.max(0, neededGrace - totalGracePurchased);

    const actualGoldSpent = breakdown.totalGold; 
    const goldShortageEfficient = Math.max(0, actualGoldSpent - currentGold);

    let message = '';

    const maxTier = isSubscribed ? FULL_PATH_SUB[FULL_PATH_SUB.length - 1] : FULL_PATH_NON_SUB[FULL_PATH_NON_SUB.length - 1];

    if (deficitRemaining > 0) {
        const maxDaysPossible = breakdown.steps.length;
        message = `⚠️ To meet the goal, you needed ${neededGrace.toLocaleString()} Grace. The maximum Grace you could purchase with your ${maxDaysPossible} login(s) was ${totalGracePurchased.toLocaleString()} Grace. You are still short ${deficitRemaining.toLocaleString()} Grace. Total Gold Cost (highest tier/cumulative required: ${maxTier.grace.toLocaleString()} Grace): ${totalGoldCostSequential.toLocaleString()}.`;
    } else if (goldShortageEfficient === 0) {
        message = `✅ You can afford the calculated purchase! Total calculated cost over ${breakdown.steps.length} days: ${actualGoldSpent.toLocaleString()} Gold. (Goal met with ${totalGracePurchased.toLocaleString()} Grace purchased).`;
    } else {
        message = `💰 You are short ${goldShortageEfficient.toLocaleString()} Gold to complete the purchase (requires ${breakdown.steps.length} login days). Total Gold cost: ${actualGoldSpent.toLocaleString()}.`;
    }
    return { requiredGold: totalGoldCostSequential, message };
}

function populateBreakdownTable(breakdown) {
    const tbody = document.getElementById('breakdownTableBody');
    tbody.innerHTML = '';
    
    if (!breakdown.steps || breakdown.steps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-green-400 font-semibold">No Grace purchase is required or no valid scenario data for this login count.</td></tr>`;
        return;
    }

    let totalGracePurchased = 0;
    let totalGoldSpent = 0;

    breakdown.steps.forEach((step) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-700 transition-colors duration-150';
        
        let tdDay = document.createElement('td');
        tdDay.className = 'px-6 py-4 whitespace-nowrap font-medium text-gray-300';
        const goldCostPerDay = step.gold;
        const gracePerDay = step.grace;
        
        let purchaseLabel = step.level > 0 ? `Full Tier ${step.level} Purchase (${gracePerDay} Grace)` : 'No Purchase';
        
        tdDay.textContent = `Day ${step.day}: ${purchaseLabel}`;
        tr.appendChild(tdDay);
        
        let tdCost = document.createElement('td');
        tdCost.className = 'px-6 py-4 whitespace-nowrap text-yellow-400';
        tdCost.textContent = `${goldCostPerDay.toLocaleString()}`; 
        tr.appendChild(tdCost);
        
        let tdGrace = document.createElement('td');
        tdGrace.className = 'px-6 py-4 whitespace-nowrap text-green-400 font-semibold';
        tdGrace.textContent = `${gracePerDay.toLocaleString()}`; 
        tr.appendChild(tdGrace);

        let tdNote = document.createElement('td');
        tdNote.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-400';
        tdNote.textContent = gracePerDay > 0 ? `Tier ${step.level}` : ''; 
        tr.appendChild(tdNote);

        tbody.appendChild(tr);
        
        totalGracePurchased += gracePerDay;
        totalGoldSpent += goldCostPerDay;
    });

    const trTotal = document.createElement('tr');
    trTotal.className = 'bg-gray-600 font-bold';
    trTotal.innerHTML = `
        <td class="px-6 py-3 text-right text-base">Total Cost (Optimized Path):</td>
        <td class="px-6 py-3 text-base text-yellow-300">${totalGoldSpent.toLocaleString()} Gold</td>
        <td class="px-6 py-3 text-base text-green-300">${totalGracePurchased.toLocaleString()} Grace</td>
        <td></td>
    `;
    tbody.appendChild(trTotal);
}

// function populateScenarioTable(maxLogins) {
//     const tbody = document.getElementById('scenarioTableBody');
//     tbody.innerHTML = '';
//     const gracePerLogin = isSubscribed ? GRACE_PER_LOGIN_SUB : GRACE_PER_LOGIN_NON_SUB;
//     const existingGrace = parseInt(document.getElementById('existingGrace').value, 10) || 0;
//     const scenarioLogins = Array.from({length: maxLogins}, (_, i) => i + 1).reverse();
    
//     scenarioLogins.forEach(logins => {
//         const graceFromLogins = (logins * gracePerLogin);
//         const earnedGrace = graceFromLogins + existingGrace;
        
//         const rawGraceRemaining = PLOT_GRACE_COST - earnedGrace;

//         const deficitToCover = Math.max(0, rawGraceRemaining);
//         const totalGoldCost = calculateGoldCostIgnoringLogins(deficitToCover);

//         const tr = document.createElement('tr');
//         tr.className = 'hover:bg-gray-700 transition-colors duration-150';
        
//         let tdLogins = document.createElement('td');
//         tdLogins.className = 'px-6 py-4 whitespace-nowrap font-medium text-white';
//         tdLogins.textContent = logins.toLocaleString();
//         tr.appendChild(tdLogins);
        
//         let tdEarned = document.createElement('td');
//         tdEarned.className = 'px-6 py-4 whitespace-nowrap text-green-400';
//         tdEarned.textContent = graceFromLogins.toLocaleString();
//         tr.appendChild(tdEarned);
        
//         let tdNeeded = document.createElement('td');
//         tdNeeded.className = 'px-6 py-4 whitespace-nowrap';
        
//         if (rawGraceRemaining > 0) {
//             tdNeeded.classList.add('text-red-400');
//             tdNeeded.textContent = rawGraceRemaining.toLocaleString();
//         } else {
//             const pureSurplus = Math.abs(rawGraceRemaining);
//             tdNeeded.classList.add('text-green-300');
//             tdNeeded.textContent = `0${pureSurplus > 0 ? ' (Surplus: ' + pureSurplus.toLocaleString() + ')' : ''}`;
//         }
//         tr.appendChild(tdNeeded);
        
//         let tdGoldCost = document.createElement('td');
//         tdGoldCost.className = 'px-6 py-4 whitespace-nowrap font-bold';
//         if (totalGoldCost > 0) {
//             tdGoldCost.classList.add('text-yellow-400');
//             tdGoldCost.textContent = totalGoldCost.toLocaleString();
//         } else {
//             tdGoldCost.classList.add('text-green-300');
//             tdGoldCost.textContent = '0';
//         }
//         tr.appendChild(tdGoldCost);
//         tbody.appendChild(tr);
//     });
// }

function calculateGrace() {
    const logins = parseInt(document.getElementById('loginsSlider').value, 10);
    const existingGrace = parseInt(document.getElementById('existingGrace').value, 10) || 0;
    const existingGold = parseInt(document.getElementById('existingGold').value, 10) || 0;
    const gracePerLogin = isSubscribed ? GRACE_PER_LOGIN_SUB : GRACE_PER_LOGIN_NON_SUB;

    const expectedGrace = logins * gracePerLogin;
    document.getElementById('expectedGrace').textContent = expectedGrace.toLocaleString();

    const totalGraceExpected = existingGrace + expectedGrace;
    const graceNeeded = Math.max(0, PLOT_GRACE_COST - totalGraceExpected);
    const rawGraceRemaining = PLOT_GRACE_COST - totalGraceExpected;

    const graceRemainingElement = document.getElementById('graceRemainingAfterLogin');
    const graceLabelElement = document.getElementById('graceRemainingLabel');
    graceRemainingElement.classList.remove('text-indigo-400', 'text-red-400', 'text-green-400');

    if (rawGraceRemaining <= 0) {
        graceRemainingElement.textContent = Math.abs(rawGraceRemaining).toLocaleString();
        graceRemainingElement.classList.add('text-green-400');
        graceLabelElement.innerHTML = 'Grace Surplus after expected logins:';
    } else {
        graceRemainingElement.textContent = rawGraceRemaining.toLocaleString();
        graceRemainingElement.classList.add('text-red-400');
        graceLabelElement.innerHTML = 'Grace Deficit remaining after expected logins (must be purchased):';
    }

    const breakdown = calculatePurchaseBreakdown(graceNeeded, logins, existingGrace);
    populateBreakdownTable(breakdown);
    
    // populateScenarioTable(logins);

    const recommendation = recommendPurchase(graceNeeded, existingGold, breakdown);
    document.getElementById('purchaseRecommendation').innerHTML = recommendation.message;
}


document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('graceTableBody')) return;
    setPlayerType('sub');
    document.getElementById('loginsSlider').value = 4; 
    document.getElementById('existingGrace').value = 0;
    document.getElementById('existingGold').value = 0;
    
    populateGraceTable();
    updateLoginsValue(document.getElementById('loginsSlider').value);
    calculateGrace();
});

window.setPlayerType = setPlayerType;
window.updateLoginsValue = updateLoginsValue;
window.calculateGrace = calculateGrace;