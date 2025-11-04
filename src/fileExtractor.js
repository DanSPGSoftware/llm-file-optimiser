import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { TableConverter } from "./tableConverter.js";

/**
 * Extract text content from various file formats
 */
export class FileExtractor {
  constructor() {
    this.tableConverter = new TableConverter();
  }
  /**
   * Extract content from a file based on its extension
   */
  async extractContent(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    try {
      switch (ext) {
        case ".docx":
          return await this.extractWordContent(filePath);
        case ".pdf":
          return await this.extractPdfContent(filePath);
        case ".txt":
        case ".md":
          return await this.extractTextContent(filePath);
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to extract content from ${filePath}: ${error.message}`
      );
    }
  }

  /**
   * Extract text from Word document
   */
  async extractWordContent(filePath) {
    const buffer = await fs.readFile(filePath);

    // First, extract as HTML to detect tables
    const htmlResult = await mammoth.convertToHtml({ buffer });

    // Convert tables to formatted lists
    const htmlWithLists = this.tableConverter.convertAllTables(htmlResult.value);

    // Convert HTML to plain text (preserving the list formatting)
    const text = this.htmlToText(htmlWithLists);

    return {
      text: text,
      wordCount: this.countWords(text),
      pageEstimate: Math.ceil(this.countWords(text) / 500), // ~500 words per page
      format: "docx",
    };
  }

  /**
   * Convert HTML to plain text while preserving structure
   */
  htmlToText(html) {
    return html
      // Preserve paragraphs
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      // Preserve line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      // Preserve lists
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      // Preserve headings
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<h[1-6][^>]*>/gi, '')
      // Remove all other tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract text from PDF
   */
  async extractPdfContent(filePath) {
    // Use pdf-parse v2 API
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: buffer });

    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    await parser.destroy();

    // Detect and mark table-like sections to help Claude identify them
    const textWithMarkedTables = this.markTableSections(textResult.text);

    return {
      text: textWithMarkedTables,
      wordCount: this.countWords(textWithMarkedTables),
      pageEstimate: infoResult.total,
      format: "pdf",
    };
  }

  /**
   * Mark table-like sections in text to help with detection
   */
  markTableSections(text) {
    const lines = text.split('\n');
    const result = [];
    let inTable = false;
    let tableLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect table-like patterns
      const hasMultipleTabs = (line.match(/\t/g) || []).length >= 2;
      const hasPipes = (line.match(/\|/g) || []).length >= 2;
      const hasConsistentSpacing = /\s{3,}/.test(line) && line.split(/\s{3,}/).length >= 3;

      if (hasMultipleTabs || hasPipes || hasConsistentSpacing) {
        if (!inTable) {
          inTable = true;
          tableLines = [];
          result.push('\n[TABLE START]');
        }
        tableLines.push(line);
      } else if (inTable && trimmed.length === 0) {
        // Empty line in table - might be part of it
        tableLines.push(line);
      } else if (inTable) {
        // Table ended
        if (tableLines.length >= 2) {
          result.push(...tableLines);
          result.push('[TABLE END]\n');
        } else {
          // False positive, wasn't really a table
          result.push(...tableLines);
        }
        inTable = false;
        tableLines = [];
        result.push(line);
      } else {
        result.push(line);
      }
    }

    // Handle if we ended while in a table
    if (inTable && tableLines.length >= 2) {
      result.push(...tableLines);
      result.push('[TABLE END]\n');
    }

    return result.join('\n');
  }

  /**
   * Extract text from plain text files
   */
  async extractTextContent(filePath) {
    const text = await fs.readFile(filePath, "utf-8");

    return {
      text,
      wordCount: this.countWords(text),
      pageEstimate: Math.ceil(this.countWords(text) / 500),
      format: "text",
    };
  }

  /**
   * Count words in text
   */
  countWords(text) {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  /**
   * Scan directory for supported files
   */
  async scanDirectory(dirPath) {
    const supportedExtensions = [".docx", ".pdf", ".txt", ".md"];
    const files = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          // Skip temporary/hidden files
          if (entry.name.startsWith("~$") || entry.name.startsWith(".")) {
            continue;
          }

          const ext = path.extname(entry.name).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            const fullPath = path.join(dirPath, entry.name);
            const stats = await fs.stat(fullPath);

            files.push({
              name: entry.name,
              path: fullPath,
              extension: ext,
              size: stats.size,
              modified: stats.mtime,
            });
          }
        }
      }

      return files.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new Error(`Failed to scan directory ${dirPath}: ${error.message}`);
    }
  }
}
