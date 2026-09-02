/**
 * Converte um gráfico (SVG do recharts) em PNG data URL para inclusão no PDF/impressão.
 */
export async function chartToDataUrl(container: HTMLElement | null): Promise<string | null> {
  if (!container) return null;
  const svg = container.querySelector("svg");
  if (!svg) return null;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(300, Math.round(rect.width));
  const height = Math.max(200, Math.round(rect.height));
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // Fundo branco e textos escuros para impressão
  clone.querySelectorAll("text").forEach((t) => t.setAttribute("fill", "#1a1a2e"));

  const xml = new XMLSerializer().serializeToString(clone);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg load error"));
      img.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
