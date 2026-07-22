import React from 'react';

export default function FormattedMessage({ text }) {
  if (!text) return null;

  // Split by line breaks to find paragraphs and lists
  const lines = text.split('\n');
  const renderedElements = [];
  let currentList = [];
  let tableRows = [];

  const parseInlineFormatting = (lineText) => {
    if (!lineText) return '';
    
    // Split by bold (**text**)
    const boldParts = lineText.split(/\*\*([^*]+)\*\*/g);
    
    return boldParts.map((boldPart, boldIdx) => {
      const isBold = boldIdx % 2 === 1;
      
      // Split the segment by italic (*text*)
      const italicParts = boldPart.split(/\*([^*]+)\*/g);
      
      const renderedParts = italicParts.map((italicPart, italicIdx) => {
        const isItalic = italicIdx % 2 === 1;
        if (isItalic) {
          return <em key={`em-${boldIdx}-${italicIdx}`}>{italicPart}</em>;
        }
        return italicPart;
      });
      
      if (isBold) {
        return <strong key={`strong-${boldIdx}`}>{renderedParts}</strong>;
      }
      
      return <React.Fragment key={`frag-${boldIdx}`}>{renderedParts}</React.Fragment>;
    });
  };

  const flushTable = (key) => {
    if (tableRows.length === 0) return;

    const headers = [];
    const rowsData = [];

    tableRows.forEach((rowStr, rowIdx) => {
      const trimmedRow = rowStr.trim();
      
      // Check if it is a separator row like |---|---|
      const isSeparator = trimmedRow.replace(/[|:\-\s]/g, '') === '';
      if (isSeparator) return; // skip separator row

      // Split row values by | and clean empty columns
      const columns = rowStr.split('|').map(col => col.trim());
      
      // Remove first and last elements if they are empty
      if (columns[0] === '') columns.shift();
      if (columns[columns.length - 1] === '') columns.pop();

      if (headers.length === 0) {
        columns.forEach((colText, colIdx) => {
          headers.push(
            <th key={`th-${colIdx}`} className="table-th">
              {parseInlineFormatting(colText)}
            </th>
          );
        });
      } else {
        const cells = columns.map((colText, colIdx) => (
          <td key={`td-${colIdx}`} className="table-td">
            {parseInlineFormatting(colText)}
          </td>
        ));
        rowsData.push(
          <tr key={`tr-${rowIdx}`} className="table-tr">
            {cells}
          </tr>
        );
      }
    });

    if (headers.length > 0 || rowsData.length > 0) {
      renderedElements.push(
        <div key={`table-container-${key}`} className="table-responsive">
          <table className="message-table">
            <thead>
              <tr className="table-tr-header">{headers}</tr>
            </thead>
            <tbody>{rowsData}</tbody>
          </table>
        </div>
      );
    }

    tableRows = [];
  };

  const flushList = (key) => {
    if (currentList.length > 0) {
      renderedElements.push(
        <ul key={`list-${key}`} className="message-list">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Check if it's a table row
    const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;

    if (isTableRow) {
      flushList(idx);
      tableRows.push(line);
      return;
    } else {
      flushTable(idx);
    }

    // If it's an empty line, flush current list and do nothing
    if (trimmed === '') {
      flushList(idx);
      return;
    }

    // Check if it's a list item (starts with - or *)
    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      currentList.push(
        <li key={`li-${idx}`} className="message-list-item">
          {parseInlineFormatting(listMatch[1])}
        </li>
      );
    } else {
      flushList(idx);

      // Check if it's a header/sub-header (e.g. starts with #)
      if (trimmed.startsWith('#')) {
        const headerLevel = trimmed.match(/^(#+)\s+(.*)$/);
        if (headerLevel) {
          const level = headerLevel[1].length;
          const content = headerLevel[2];
          const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
          renderedElements.push(
            <Tag key={`h-${idx}`} className={`message-h${level}`}>
              {parseInlineFormatting(content)}
            </Tag>
          );
          return;
        }
      }

      // Standalone bold headers like **Answer:**
      const boldHeaderMatch = trimmed.match(/^\*\*([^*]+):\*\*\s*$/);
      if (boldHeaderMatch) {
        renderedElements.push(
          <h4 key={`h4-${idx}`} className="message-h4">
            {boldHeaderMatch[1]}:
          </h4>
        );
        return;
      }

      if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
        renderedElements.push(
          <h4 key={`h4-${idx}`} className="message-h4">
            {trimmed.slice(2, -2)}
          </h4>
        );
        return;
      }

      // Default paragraph
      renderedElements.push(
        <p key={`p-${idx}`} className="message-paragraph">
          {parseInlineFormatting(line)}
        </p>
      );
    }
  });

  // Flush remaining table or list at the end
  flushTable('final');
  flushList('final');

  return <div className="formatted-message">{renderedElements}</div>;
}
