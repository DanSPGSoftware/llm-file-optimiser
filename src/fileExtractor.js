import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

/**
 * Extract text content from various file formats
 */
export class FileExtractor {
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
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value,
      wordCount: this.countWords(result.value),
      pageEstimate: Math.ceil(this.countWords(result.value) / 500), // ~500 words per page
      format: "docx",
    };
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

    return {
      text: textResult.text,
      wordCount: this.countWords(textResult.text),
      pageEstimate: infoResult.total,
      format: "pdf",
    };
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
