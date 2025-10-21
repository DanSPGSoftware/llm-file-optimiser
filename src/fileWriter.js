import fs from 'fs/promises';
import path from 'path';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { Packer } from 'docx';

/**
 * Write optimized content to files with metadata
 */
export class FileWriter {
  /**
   * Save optimized content to appropriate format
   */
  async saveOptimizedContent(originalFilePath, optimizedContent, summary, outputDir) {
    const ext = path.extname(originalFilePath).toLowerCase();
    const baseName = path.basename(originalFilePath, ext);
    const outputPath = path.join(outputDir, `${baseName}_optimized${ext}`);

    try {
      if (ext === '.docx') {
        await this.saveAsWordDocument(outputPath, optimizedContent, summary);
      } else {
        // For PDF and text files, save as markdown
        const markdownPath = path.join(outputDir, `${baseName}_optimized.md`);
        await this.saveAsMarkdown(markdownPath, optimizedContent, summary);
        return markdownPath;
      }

      return outputPath;
    } catch (error) {
      throw new Error(`Failed to save optimized file: ${error.message}`);
    }
  }

  /**
   * Save content as Word document with metadata
   */
  async saveAsWordDocument(outputPath, markdownContent, summary) {
    // Convert markdown to Word document sections
    const paragraphs = this.markdownToWordParagraphs(markdownContent);

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [
              {
                level: 0,
                format: 'decimal',
                text: '%1.',
                alignment: 'start',
              },
            ],
          },
        ],
      },
      sections: [{
        properties: {},
        children: paragraphs
      }],
      properties: {
        title: 'Optimized Document',
        subject: summary,
        description: summary,
        comments: summary
      }
    });

    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(outputPath, buffer);
  }

  /**
   * Convert markdown content to Word paragraphs
   */
  markdownToWordParagraphs(markdown) {
    const lines = markdown.split('\n');
    const paragraphs = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines
      if (!line.trim()) {
        paragraphs.push(new Paragraph({ text: '' }));
        continue;
      }

      // H6 heading (check longest first!)
      if (line.startsWith('###### ')) {
        const headingText = line.substring(7);
        const runs = this.parseInlineFormatting(headingText);
        paragraphs.push(new Paragraph({
          children: runs,
          heading: HeadingLevel.HEADING_6
        }));
      }
      // H5 heading
      else if (line.startsWith('##### ')) {
        const headingText = line.substring(6);
        const runs = this.parseInlineFormatting(headingText);
        paragraphs.push(new Paragraph({
          children: runs,
          heading: HeadingLevel.HEADING_5
        }));
      }
      // H4 heading
      else if (line.startsWith('#### ')) {
        const headingText = line.substring(5);
        const runs = this.parseInlineFormatting(headingText);
        paragraphs.push(new Paragraph({
          children: runs,
          heading: HeadingLevel.HEADING_4
        }));
      }
      // H3 heading
      else if (line.startsWith('### ')) {
        const headingText = line.substring(4);
        const runs = this.parseInlineFormatting(headingText);
        paragraphs.push(new Paragraph({
          children: runs,
          heading: HeadingLevel.HEADING_3
        }));
      }
      // H2 heading
      else if (line.startsWith('## ')) {
        const headingText = line.substring(3);
        const runs = this.parseInlineFormatting(headingText);
        paragraphs.push(new Paragraph({
          children: runs,
          heading: HeadingLevel.HEADING_2
        }));
      }
      // H1 heading
      else if (line.startsWith('# ')) {
        const headingText = line.substring(2);
        const runs = this.parseInlineFormatting(headingText);
        paragraphs.push(new Paragraph({
          children: runs,
          heading: HeadingLevel.HEADING_1
        }));
      }
      // Horizontal rule (---, ***, ___)
      else if (line.match(/^(\-{3,}|\*{3,}|_{3,})$/)) {
        paragraphs.push(new Paragraph({
          text: '═══════════════════════════════════════════════════════════',
          spacing: { before: 200, after: 200 }
        }));
      }
      // Blockquote (> text)
      else if (line.startsWith('> ')) {
        const quoteText = line.substring(2);
        const runs = this.parseInlineFormatting(quoteText);
        paragraphs.push(new Paragraph({
          children: runs,
          indent: { left: 720 }, // 0.5 inch indent
          italics: true
        }));
      }
      // Bullet point
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        const bulletText = line.substring(2);
        const runs = this.parseInlineFormatting(bulletText);
        paragraphs.push(new Paragraph({
          children: runs,
          bullet: { level: 0 }
        }));
      }
      // Numbered list
      else if (line.match(/^\d+\.\s/)) {
        const listText = line.replace(/^\d+\.\s/, '');
        const runs = this.parseInlineFormatting(listText);
        paragraphs.push(new Paragraph({
          children: runs,
          numbering: { reference: 'default-numbering', level: 0 }
        }));
      }
      // Regular paragraph with bold support
      else {
        const runs = this.parseInlineFormatting(line);
        paragraphs.push(new Paragraph({ children: runs }));
      }
    }

    return paragraphs;
  }

  /**
   * Parse inline formatting (bold, italic, code)
   */
  parseInlineFormatting(text) {
    // Handle inline code first (backticks) to avoid conflicts
    text = text.replace(/`([^`]+)`/g, '$1');

    const runs = [];
    const segments = [];
    let lastIndex = 0;

    // Combined regex for bold and italic
    // Matches: **bold**, *italic*, or ***bold+italic***
    const formatRegex = /(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*)|(\*(.+?)\*)/g;
    let match;
    let hasFormatting = false;

    while ((match = formatRegex.exec(text)) !== null) {
      hasFormatting = true;

      // Add text before the formatting
      if (match.index > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, match.index),
          bold: false,
          italic: false
        });
      }

      // Determine which type of formatting
      if (match[1]) {
        // ***bold and italic***
        segments.push({ text: match[2], bold: true, italic: true });
      } else if (match[3]) {
        // **bold**
        segments.push({ text: match[4], bold: true, italic: false });
      } else if (match[5]) {
        // *italic*
        segments.push({ text: match[6], bold: false, italic: true });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last match
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        bold: false,
        italic: false
      });
    }

    // If no formatting found, return plain text
    if (!hasFormatting) {
      return [new TextRun({ text })];
    }

    // Convert segments to TextRuns
    for (const segment of segments) {
      if (segment.text) {
        runs.push(new TextRun({
          text: segment.text,
          bold: segment.bold,
          italics: segment.italic
        }));
      }
    }

    return runs.length > 0 ? runs : [new TextRun({ text })];
  }

  /**
   * Save content as markdown file
   */
  async saveAsMarkdown(outputPath, content, summary) {
    const fullContent = `---
description: ${summary}
---

${content}`;

    await fs.writeFile(outputPath, fullContent, 'utf-8');
  }

  /**
   * Save split topic files
   */
  async saveSplitFiles(originalFilePath, topics, optimizedContents, outputDir) {
    const ext = path.extname(originalFilePath).toLowerCase();
    const baseName = path.basename(originalFilePath, ext);
    const savedFiles = [];

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const content = optimizedContents[i];
      const sanitizedTopicName = this.sanitizeFilename(topic.topicName);
      const outputPath = path.join(outputDir, `${baseName}_${sanitizedTopicName}${ext}`);

      if (ext === '.docx') {
        await this.saveAsWordDocument(outputPath, content, topic.description);
      } else {
        const markdownPath = path.join(outputDir, `${baseName}_${sanitizedTopicName}.md`);
        await this.saveAsMarkdown(markdownPath, content, topic.description);
        savedFiles.push(markdownPath);
        continue;
      }

      savedFiles.push(outputPath);
    }

    return savedFiles;
  }

  /**
   * Sanitize filename
   */
  sanitizeFilename(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }
}
