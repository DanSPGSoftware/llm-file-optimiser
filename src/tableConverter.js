/**
 * Utility for detecting and converting tables to formatted lists
 */
export class TableConverter {
  /**
   * Convert HTML table to formatted list
   */
  convertTableToList(tableHtml) {
    // Parse table structure from HTML
    const rows = this.parseTableRows(tableHtml);

    if (rows.length === 0) {
      return '';
    }

    // Separate header and data rows
    const hasHeader = this.detectHeader(rows);
    const headerRow = hasHeader ? rows[0] : null;
    const dataRows = hasHeader ? rows.slice(1) : rows;

    // Convert to formatted list
    let result = [];

    if (headerRow) {
      result.push(`**Table: ${this.getTableTitle(headerRow)}**\n`);
    }

    // Convert each row to a list item
    dataRows.forEach((row, index) => {
      if (headerRow) {
        // Create descriptive list item using header labels
        const items = row.map((cell, cellIndex) => {
          const label = headerRow[cellIndex] || `Column ${cellIndex + 1}`;
          return `${label}: ${cell}`;
        }).filter(item => item.trim());

        if (items.length > 0) {
          result.push(`${index + 1}. ${items.join(' | ')}`);
        }
      } else {
        // No header, just list the values
        const items = row.filter(cell => cell.trim());
        if (items.length > 0) {
          result.push(`${index + 1}. ${items.join(' | ')}`);
        }
      }
    });

    return result.join('\n') + '\n';
  }

  /**
   * Parse table rows from HTML
   */
  parseTableRows(html) {
    const rows = [];

    // Match table rows
    const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      const cells = this.parseTableCells(rowHtml);

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    return rows;
  }

  /**
   * Parse table cells from row HTML
   */
  parseTableCells(rowHtml) {
    const cells = [];

    // Match both th and td cells
    const cellRegex = /<t[hd][^>]*>(.*?)<\/t[hd]>/gis;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const cellContent = this.stripHtmlTags(cellMatch[1]).trim();
      cells.push(cellContent);
    }

    return cells;
  }

  /**
   * Strip HTML tags from text
   */
  stripHtmlTags(html) {
    return html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detect if first row is a header
   */
  detectHeader(rows) {
    if (rows.length === 0) return false;

    const firstRow = rows[0];
    const secondRow = rows.length > 1 ? rows[1] : null;

    // If first row has shorter cells, it's likely a header
    if (secondRow) {
      const firstRowAvgLength = firstRow.reduce((sum, cell) => sum + cell.length, 0) / firstRow.length;
      const secondRowAvgLength = secondRow.reduce((sum, cell) => sum + cell.length, 0) / secondRow.length;

      if (firstRowAvgLength < secondRowAvgLength * 0.7) {
        return true;
      }
    }

    // Check if first row cells look like headers (short, no punctuation at end)
    const looksLikeHeader = firstRow.every(cell => {
      return cell.length < 50 && !cell.match(/[.!?]$/);
    });

    return looksLikeHeader;
  }

  /**
   * Get table title from header row
   */
  getTableTitle(headerRow) {
    // Create a title from the header cells
    const title = headerRow.filter(cell => cell.trim()).join(', ');
    return title.length > 50 ? 'Data Table' : title;
  }

  /**
   * Convert all tables in HTML content to lists
   */
  convertAllTables(html) {
    let result = html;

    // Find all tables
    const tableRegex = /<table[^>]*>(.*?)<\/table>/gis;
    const tables = [];
    let match;

    while ((match = tableRegex.exec(html)) !== null) {
      tables.push({
        fullMatch: match[0],
        content: match[1]
      });
    }

    // Replace each table with formatted list
    tables.forEach(table => {
      const listFormat = this.convertTableToList(table.fullMatch);
      result = result.replace(table.fullMatch, listFormat);
    });

    return result;
  }

  /**
   * Detect table-like patterns in plain text (for PDFs)
   */
  detectTextTables(text) {
    const lines = text.split('\n');
    const tablePatterns = [];
    let currentTable = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect table-like patterns (multiple tabs, pipes, or consistent spacing)
      const hasMultipleTabs = (line.match(/\t/g) || []).length >= 2;
      const hasPipes = (line.match(/\|/g) || []).length >= 2;
      const hasConsistentSpacing = /\s{3,}/.test(line) && line.split(/\s{3,}/).length >= 3;

      if (hasMultipleTabs || hasPipes || hasConsistentSpacing) {
        if (!inTable) {
          inTable = true;
          currentTable = [];
        }
        currentTable.push(line);
      } else if (inTable && line.length === 0) {
        // Empty line might indicate end of table
        continue;
      } else if (inTable) {
        // Table ended
        if (currentTable.length >= 2) {
          tablePatterns.push({
            startLine: i - currentTable.length,
            endLine: i - 1,
            content: currentTable.join('\n')
          });
        }
        inTable = false;
        currentTable = [];
      }
    }

    // Check if we ended while in a table
    if (inTable && currentTable.length >= 2) {
      tablePatterns.push({
        startLine: lines.length - currentTable.length,
        endLine: lines.length - 1,
        content: currentTable.join('\n')
      });
    }

    return tablePatterns;
  }
}
