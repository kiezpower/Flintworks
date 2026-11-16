// Each alternative changes the use of a role, rather than simply shortening its timer.
const VARIANTS = {
 anna: { name: 'Präzisionshieb', desc: 'Mehr Grabkraft in hartem Boden, kein aktiver Schub in weichem Boden.', duration: 300, cooldown: 1800 },
 bruno: { name: 'Sammelruf', desc: 'Zieht lose Gegenstände heran, statt schneller zu laufen.', duration: 360, cooldown: 1800 },
 mika: { name: 'Schatzpeilung', desc: 'Zeigt die vier nächsten Gold- und Edelsteinfunde statt aller Rohstoffe.', duration: 360, cooldown: 1800 },
 juna: { name: 'Sicherer Aufstieg', desc: 'Normaler Seilzug, dafür 60 % weniger Fallschaden während der Wirkung.', duration: 360, cooldown: 1800 },
 toni: { name: 'Baustellenschub', desc: 'Beschleunigt eigene Bauhilfe statt der Produktion.', duration: 360, cooldown: 2100 },
 nora: { name: 'Entgiften', desc: 'Beendet Gift und Brand sofort, schützt danach nur leicht vor Schaden.', duration: 120, cooldown: 2100 },
};
export { VARIANTS };
