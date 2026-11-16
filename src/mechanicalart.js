// Moving parts stay live; curves are drawn at the final canvas resolution.
function drawSailRotor(g, x, y, angle, radius = 10) {
  g.save(); g.translate(x, y);
  for (let k = 0; k < 4; k++) {
    g.save(); g.rotate(angle + k * Math.PI / 2);
    const wood = g.createLinearGradient(-0.6, 0, 0.6, 0); wood.addColorStop(0, '#ead2a1'); wood.addColorStop(1, '#84603d');
    g.fillStyle = wood; g.beginPath(); g.roundRect(-0.55, -radius, 1.1, radius, 0.35); g.fill();
    const cloth = g.createLinearGradient(0.4, 0, 3.5, 0); cloth.addColorStop(0, '#f8edce'); cloth.addColorStop(1, '#c4ac82');
    g.fillStyle = cloth; g.beginPath(); g.roundRect(0.45, -radius + 0.5, 2.8, radius * 0.6, 0.4); g.fill();
    g.strokeStyle = '#9e835c'; g.lineWidth = 0.12;
    for (let r = 2; r < radius * 0.6; r += 1.5) { g.beginPath(); g.moveTo(0.5, -radius + r); g.lineTo(3.2, -radius + r); g.stroke(); }
    g.restore();
  }
  g.fillStyle = '#b98b49'; g.beginPath(); g.arc(0, 0, 1.1, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#493d30'; g.beginPath(); g.arc(0, 0, 0.45, 0, Math.PI * 2); g.fill(); g.restore();
}
function drawGate(g, x, y, open) {
  g.save();
  g.fillStyle = '#392d24'; g.beginPath(); g.roundRect(x + 1, y + 1, 6, 15, 1.5); g.fill();
  g.save(); g.beginPath(); g.rect(x + 2, y + 2, 4, 14); g.clip();
  const doorY = y + 2 - Math.max(0, Math.min(1, open || 0)) * 12;
  const wood = g.createLinearGradient(x + 2, 0, x + 6, 0); wood.addColorStop(0, '#b78750'); wood.addColorStop(1, '#69482f');
  g.fillStyle = wood; g.fillRect(x + 2, doorY, 4, 14);
  g.strokeStyle = '#4e3828'; g.lineWidth = 0.2;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + 2 + k, doorY); g.lineTo(x + 2 + k, doorY + 14); g.stroke(); }
  g.strokeStyle = '#a3b0ae'; g.lineWidth = 0.55;
  for (const dy of [3, 10]) { g.beginPath(); g.moveTo(x + 2, doorY + dy); g.lineTo(x + 6, doorY + dy); g.stroke(); }
  g.restore();
  const stone = g.createLinearGradient(x, 0, x + 8, 0); stone.addColorStop(0, '#d0c7aa'); stone.addColorStop(0.5, '#9b9b88'); stone.addColorStop(1, '#707a70');
  g.fillStyle = stone;
  for (const dx of [0, 6]) { g.beginPath(); g.roundRect(x + dx, y, 2, 16, 0.3); g.fill(); }
  g.strokeStyle = '#656d62'; g.lineWidth = 0.15;
  for (let k = 3; k < 16; k += 3) { g.beginPath(); g.moveTo(x, y + k); g.lineTo(x + 2, y + k); g.moveTo(x + 6, y + k); g.lineTo(x + 8, y + k); g.stroke(); }
  g.restore();
}
export { drawGate, drawSailRotor };
