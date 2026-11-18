// Les scènes que Rec sait filmer. Chaque plan = une sauvegarde patchée + des actions dans DataOS.
// house : 0 chambre, 1 studio, 2 T3, 3 maison, 4 open space, 5 entrepôt, 6 immeuble, 7 campus, 8 data center, 9 station orbitale.
const ALL_APPS = ['terminal', 'browser', 'shop', 'mail', 'missions', 'trade', 'league', 'pc', 'lab', 'influence', 'security', 'guild', 'company', 'news'];
const COSTS = [0, 800, 12e3, 25e4, 5e6, 1e8, 2e9, 5e10, 1e12, 3e13];
// Emplacements de chaque logement (les 6 premiers viennent du jeu, les suivants sont prudents).
const SLOTS = [12, 30, 70, 150, 300, 500, 800, 1200, 1800, 3000];
const at = (house, extra = {}) => {
  // Environ un tiers des emplacements occupés, sur le meilleur type de machine accessible : l'électricité reste crédible.
  const rigs = Array(9).fill(0);
  rigs[Math.min(house, 8)] = Math.max(3, Math.round(SLOTS[house] / 3));
  return {
    house,
    credits: Math.max(500, COSTS[house] * 3),
    totalCredits: Math.max(1000, COSTS[house] * 10),
    rigs,
    gpus: Array(7).fill(0),
    unlocked: house >= 2 ? ALL_APPS : ['terminal', 'browser', 'shop', 'mail'],
    ...extra,
  };
};

export const SCENES = {
  // De la chambre à la station orbitale : un plan court par logement.
  orbit: { shots: COSTS.map((_, h) => ({ patch: at(h), steps: [{ wait: 400 }, { scroll: 900 }, { wait: 500 }], mark: 'afterSteps', hold: 1800 })) },
  // Première heure : on part de zéro et on mine à la main.
  firsthour: { shots: [{ patch: at(0, { credits: 0, totalCredits: 0 }), steps: [{ open: 'MineCore' }, { wait: 800 }, { tap: 'Miner', times: 40, every: 150 }], hold: 3000 }] },
  // Marché DataTrade.
  trade: { shots: [{ patch: at(4), steps: [{ open: 'DataTrade' }, { wait: 12000 }], hold: 3000 }] },
  // NeuralLab.
  lab: { shots: [{ patch: at(5), steps: [{ open: 'NeuralLab' }, { wait: 6000 }, { scroll: 500 }, { wait: 4000 }], hold: 2500 }] },
  // Classement.
  league: { shots: [{ patch: at(3), steps: [{ open: 'Classement' }, { wait: 5000 }, { scroll: 600 }, { wait: 4000 }], hold: 2500 }] },
  // Renaissance.
  renaissance: { shots: [{ patch: at(8), steps: [{ open: 'Renaissance' }, { wait: 6000 }, { scroll: 500 }, { wait: 3000 }], hold: 2500 }] },
  // Guilde.
  guild: { shots: [{ patch: at(4), steps: [{ open: 'Guilde' }, { wait: 6000 }], hold: 2500 }] },
  // Tour rapide de DataOS à un stade avancé.
  tour: { shots: [{ patch: at(7), steps: [{ wait: 2500 }, { open: 'Mon PC' }, { wait: 3500 }, { close: true }, { open: 'Influence' }, { wait: 3500 }, { close: true }, { open: 'Sécurité' }, { wait: 3500 }], hold: 2000 }] },
};

// Série du calendrier éditorial → scène par défaut.
export const SERIES_TO_SCENE = {
  "De la chambre à l'orbite": 'orbit', 'Krach sur DataTrade': 'trade', NeuralLab: 'lab', 'Défis': 'league',
  Renaissance: 'renaissance', Classement: 'league', 'Nouveautés': 'tour', Guilde: 'guild',
};
