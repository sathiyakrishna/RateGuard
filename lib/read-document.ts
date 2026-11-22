// Browser only: read an uploaded PDF or text file into plain text.
const MAX_PDF_PAGES = 30;

export async function readDocument(file: File): Promise<string> {
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();
    let doc;
    try {
      // isEvalSupported: false closes CVE-2024-4367 (font code run through eval in pdf.js before 4.2.67)
      doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    } catch {
      throw new Error(`${file.name} could not be opened. It may be damaged or password protected.`);
    }
    if (doc.numPages > MAX_PDF_PAGES) throw new Error(`${file.name} has ${doc.numPages} pages. The limit is ${MAX_PDF_PAGES}.`);
    let out = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      for (const it of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
        if (typeof it.str !== 'string') continue;
        out += it.str + (it.hasEOL ? '\n' : ' ');
      }
      out += '\n';
    }
    if (out.replace(/\s/g, '').length < 40) throw new Error(`${file.name} looks scanned. Please upload a text-based PDF or a text file.`);
    return out;
  }
  const text = await file.text();
  if (text.trim().length < 20) throw new Error(`${file.name} is empty or too short to read.`);
  return text;
}
