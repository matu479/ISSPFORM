import { inflateRawSync } from 'node:zlib';

export const runtime = 'nodejs';

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

function extractZipEntry(archive: Buffer, targetName: string) {
  const minimumOffset = Math.max(0, archive.length - 65_557);
  let endOffset = -1;

  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      endOffset = offset;
      break;
    }
  }

  if (endOffset < 0) throw new Error('El archivo DOCX no es válido.');

  const entryCount = archive.readUInt16LE(endOffset + 10);
  let offset = archive.readUInt32LE(endOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== CENTRAL_DIRECTORY_HEADER) {
      throw new Error('El índice interno del DOCX no es válido.');
    }

    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const fileName = archive
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString('utf8');

    if (fileName === targetName) {
      if (archive.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) {
        throw new Error('El contenido interno del DOCX no es válido.');
      }

      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = archive.subarray(
        dataOffset,
        dataOffset + compressedSize,
      );

      if (method === 0) return compressed;
      if (method === 8) {
        return inflateRawSync(compressed, { maxOutputLength: 20_000_000 });
      }
      throw new Error('El DOCX usa una compresión no compatible.');
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error('No se encontró el documento principal dentro del DOCX.');
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function extractParagraphText(xml: string) {
  const withSeparators = xml
    .replace(/<w:tab(?:\s[^>]*)?\/?\s*>/g, '\t')
    .replace(/<w:(?:br|cr)(?:\s[^>]*)?\/?\s*>/g, '\n');
  const textParts = [...withSeparators.matchAll(
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|([\t\n])/g,
  )]
    .map((match) => (match[1] ? decodeXml(match[1]) : match[2]))
    .join('');

  return textParts
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function extractCellText(xml: string) {
  const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
    .map((match) => extractParagraphText(match[1]))
    .filter(Boolean);

  if (paragraphs.length > 0) return paragraphs.join('\n');
  return extractParagraphText(xml);
}

function extractTables(xml: string) {
  return [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/g)]
    .map((tableMatch) =>
      [...tableMatch[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)]
        .map((rowMatch) =>
          [...rowMatch[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)]
            .map((cellMatch) => extractCellText(cellMatch[1])),
        )
        .filter((row) => row.some(Boolean)),
    )
    .filter((table) => table.length > 0);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploaded = formData.get('file');

    if (!(uploaded instanceof File)) {
      return Response.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    if (!uploaded.name.toLocaleLowerCase('es').endsWith('.docx')) {
      return Response.json({ error: 'El archivo debe tener extensión .docx.' }, { status: 400 });
    }

    if (uploaded.size > 8_000_000) {
      return Response.json({ error: 'El archivo supera el límite de 8 MB.' }, { status: 400 });
    }

    const archive = Buffer.from(await uploaded.arrayBuffer());
    const documentXml = extractZipEntry(
      archive,
      'word/document.xml',
    ).toString('utf8');
    const tables = extractTables(documentXml);
    const paragraphs = [
      ...documentXml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g),
    ]
      .map((match) => extractParagraphText(match[1]))
      .filter(Boolean);

    if (tables.length === 0 && paragraphs.length === 0) {
      return Response.json(
        { error: 'No se encontró texto para importar dentro del Word.' },
        { status: 422 },
      );
    }

    return Response.json({ tables, paragraphs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo procesar el Word.';
    return Response.json({ error: message }, { status: 422 });
  }
}
