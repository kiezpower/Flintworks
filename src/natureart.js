// Small plants and cave details use native canvas curves, not enlarged bitmap dots.
function drawNature(g, d, x, y, biome) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const h = d.h || 3;
  const stem = (color, x1, y1, x2, y2, width = 0.35) => {
    g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2 + 0.35, y2, x2, y2); g.stroke();
  };
  if (d.kind === 'root') {
    stem('#614832', x, y, x + d.side, y + h, 0.65);
    stem('#927044', x + d.side * 0.4, y + h * 0.45, x - d.side * 1.3, y + h * 0.7, 0.25);
  } else if (d.kind === 'stal') {
    const snowy = biome === 'winter';
    const shade = g.createLinearGradient(x - 1, y, x + 2, y);
    shade.addColorStop(0, snowy ? '#d5f3f6' : '#c3bfa5'); shade.addColorStop(1, snowy ? '#6babbf' : '#666c66');
    g.fillStyle = shade; g.beginPath(); g.moveTo(x - 1.3, y); g.quadraticCurveTo(x - 0.8, y + h * 0.7, x + 0.3, y + h); g.quadraticCurveTo(x + 0.6, y + h * 0.3, x + 1.5, y); g.closePath(); g.fill();
  } else if (d.kind === 'grass' || d.kind === 'stalks' || d.kind === 'bush') {
    const dry = d.kind !== 'grass';
    for (let k = -1; k <= 1; k++) stem(dry ? '#aa956c' : k ? '#709749' : '#a7bc64', x, y, x + k * 1.5, y - h + Math.abs(k), 0.3);
  } else if (d.kind === 'flower') {
    stem('#739548', x, y, x + 0.2, y - 2.5);
    g.fillStyle = d.c;
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 0.4; g.beginPath(); g.ellipse(x + Math.cos(a) * 0.55, y - 2.8 + Math.sin(a) * 0.55, 0.55, 0.32, a, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffe4a0'; g.beginPath(); g.arc(x, y - 2.8, 0.3, 0, Math.PI * 2); g.fill();
  } else if (d.kind === 'shroom') {
    stem('#c7d6ba', x, y, x, y - h, 0.7);
    const cap = g.createLinearGradient(x, y - h - 1.7, x, y - h);
    cap.addColorStop(0, '#b0f7de'); cap.addColorStop(1, '#3d9c9a'); g.fillStyle = cap;
    g.beginPath(); g.ellipse(x, y - h, 1.7, 1.3, 0, Math.PI, Math.PI * 2); g.quadraticCurveTo(x + 0.4, y - h + 0.45, x - 1.7, y - h); g.fill();
  } else if (d.kind === 'crystal') {
    const crystal = (dx, scale) => {
      g.fillStyle = '#9274ce'; g.beginPath(); g.moveTo(x + dx - 0.55, y); g.lineTo(x + dx - 0.55, y - h * scale); g.lineTo(x + dx, y - (h + 1.5) * scale); g.lineTo(x + dx + 0.7, y - h * scale); g.lineTo(x + dx + 0.55, y); g.closePath(); g.fill();
      g.fillStyle = '#dfc8fa'; g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx - 0.2, y - (h + 1.5) * scale); g.lineTo(x + dx - 0.55, y - h * scale); g.lineTo(x + dx - 0.55, y); g.fill();
    };
    crystal(0, 1); crystal(1, 0.65);
  } else {
    const stone = g.createLinearGradient(x, y - 1, x, y + 0.4); stone.addColorStop(0, '#bab3a0'); stone.addColorStop(1, '#646b63');
    g.fillStyle = stone; g.beginPath(); g.ellipse(x + 0.5, y - 0.35, 1.3, 0.7, -0.15, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
export { drawNature };
