// Course identities and geometry are stable so saved scores remain comparable across attempts.
export const COURSES = [
  {
    id: 'yard', name: 'Werkhof', target: 65, sky: '#8fb7c9', backing: '#3e2a25',
    desc: 'Drei Ladungen. Lege Gold frei und triff die Pulverfässer für Kettenreaktionen.',
    medals: [1000, 2500, 4000],
    veins: [[65, 65, 10, 8, 3], [95, 74, 12, 9, 3], [151, 77, 12, 8, 3],
      [182, 84, 11, 8, 3], [115, 94, 7, 5, 13], [213, 78, 8, 6, 13]],
    barrels: [[65, 12], [94, 12], [151, 12], [181, 12]],
  },
  {
    id: 'chain', name: 'Kettenstollen', target: 57, sky: '#c6ad88', backing: '#422c22',
    desc: 'Zünde die lange Fassreihe. Jeder weitere Knall erhöht den Punktmultiplikator.',
    medals: [3000, 7000, 9000],
    veins: [[57, 71, 10, 8, 3], [84, 77, 10, 8, 3], [111, 80, 10, 8, 3],
      [138, 84, 10, 8, 3], [165, 86, 10, 8, 3], [192, 91, 10, 8, 3],
      [110, 104, 6, 4, 13], [170, 107, 6, 4, 13], [218, 88, 7, 5, 13]],
    barrels: [[57, 14], [84, 14], [111, 14], [138, 14], [165, 14], [192, 14]],
  },
  {
    id: 'gems', name: 'Edelsteinkammer', target: 72, sky: '#aaa9c9', backing: '#30283e',
    desc: 'Die Edelsteine liegen tief. Nutze deine Krater, um die nächste Ladung tiefer zu werfen.',
    medals: [1500, 4000, 7000],
    veins: [[72, 78, 8, 6, 13], [102, 95, 9, 7, 13], [155, 91, 9, 7, 13],
      [198, 104, 8, 6, 13], [130, 76, 10, 7, 3], [214, 80, 8, 6, 3]],
    barrels: [[72, 17], [100, 36], [158, 24], [196, 35]],
  },
];
export const courseOf = id => COURSES.find(c => c.id === id) || COURSES[0];
export const medalOf = (id, score) => courseOf(id).medals.filter(n => score >= n).length;
export const MEDAL_NAMES = ['Noch keine Medaille', 'Bronze', 'Silber', 'Gold'];
