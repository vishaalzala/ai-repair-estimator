type PdfLine = {
  text: string;
  bold?: boolean;
  size?: number;
  indent?: number;
  gapAfter?: number;
};

export type SimplePdfDocument = {
  title: string;
  subtitle?: string;
  lines: PdfLine[];
  footer?: string;
};

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, (char) => {
      if (char === "–" || char === "—") return "-";
      if (char === "•") return "*";
      return "?";
    });
}

function wrapText(text: string, maxChars: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    if (`${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current += ` ${word}`;
    }
  }
  lines.push(current);
  return lines;
}

function pageContent(document: SimplePdfDocument) {
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = 790;

  function beginPage() {
    commands = ["BT", "/F2 18 Tf", "50 805 Td", `(${escapePdfText(document.title)}) Tj`];
    y = 776;
    if (document.subtitle) {
      commands.push("/F1 9 Tf", `0 -22 Td`, `(${escapePdfText(document.subtitle)}) Tj`);
      y = 754;
    }
  }

  function endPage() {
    if (document.footer) {
      commands.push("ET", "BT", "/F1 8 Tf", `50 28 Td`, `(${escapePdfText(document.footer)}) Tj`);
    }
    commands.push("ET");
    pages.push(commands);
  }

  beginPage();
  for (const line of document.lines) {
    const size = line.size ?? 10;
    const maxChars = Math.max(35, Math.floor((88 - (line.indent ?? 0) * 8) * (10 / size)));
    const wrapped = wrapText(line.text, maxChars);
    const lineHeight = Math.max(13, Math.round(size * 1.35));

    for (const [index, segment] of wrapped.entries()) {
      if (y < 65) {
        endPage();
        beginPage();
      }
      const x = 50 + (line.indent ?? 0) * 18;
      commands.push(
        `/${line.bold ? "F2" : "F1"} ${size} Tf`,
        `1 0 0 1 ${x} ${y} Tm`,
        `(${escapePdfText(segment)}) Tj`,
      );
      y -= lineHeight;
      if (index === wrapped.length - 1) y -= line.gapAfter ?? 0;
    }
  }
  endPage();
  return pages;
}

export function renderSimplePdf(document: SimplePdfDocument) {
  const pages = pageContent(document);
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds: number[] = [];

  for (const contentCommands of pages) {
    const content = contentCommands.join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
