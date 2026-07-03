import type { TextSegment } from '../state/AppState.js';

interface StyleState {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

// ANSI color codes to hex colors (traditional terminal palette)
// Using xterm-256color palette for consistency with classic terminals
const ANSI_COLORS: Record<number, string> = {
  30: '#000000', // Black
  31: '#cd0000', // Red
  32: '#00cd00', // Green
  33: '#cdcd00', // Yellow (brown/orange in many terminals)
  34: '#0000ee', // Blue
  35: '#cd00cd', // Magenta
  36: '#00cdcd', // Cyan
  37: '#e5e5e5', // White (light gray)
  90: '#7f7f7f', // Bright Black (dark gray)
  91: '#ff0000', // Bright Red
  92: '#00ff00', // Bright Green
  93: '#ffff00', // Bright Yellow
  94: '#5c5cff', // Bright Blue
  95: '#ff00ff', // Bright Magenta
  96: '#00ffff', // Bright Cyan
  97: '#ffffff', // Bright White
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: '#000000', // Black
  41: '#cd0000', // Red
  42: '#00cd00', // Green
  43: '#cdcd00', // Yellow (brown/orange)
  44: '#0000ee', // Blue
  45: '#cd00cd', // Magenta
  46: '#00cdcd', // Cyan
  47: '#e5e5e5', // White (light gray)
  100: '#7f7f7f', // Bright Black (dark gray)
  101: '#ff0000', // Bright Red
  102: '#00ff00', // Bright Green
  103: '#ffff00', // Bright Yellow
  104: '#5c5cff', // Bright Blue
  105: '#ff00ff', // Bright Magenta
  106: '#00ffff', // Bright Cyan
  107: '#ffffff', // Bright White
};

// Convert 256-color palette index to hex color
function color256ToHex(index: number): string {
  if (index < 0 || index > 255) return '#ffffff';

  // Standard colors (0-15) - use standard terminal palette
  const standardColors = [
    '#000000',
    '#800000',
    '#008000',
    '#808000',
    '#000080',
    '#800080',
    '#008080',
    '#c0c0c0',
    '#808080',
    '#ff0000',
    '#00ff00',
    '#ffff00',
    '#0000ff',
    '#ff00ff',
    '#00ffff',
    '#ffffff',
  ];

  if (index < 16) {
    return standardColors[index];
  }

  // 216-color cube (16-231): 6x6x6 RGB
  if (index >= 16 && index <= 231) {
    const i = index - 16;
    const r = Math.floor(i / 36);
    const g = Math.floor((i % 36) / 6);
    const b = i % 6;

    const toRgb = (value: number) => {
      if (value === 0) return 0;
      return 55 + value * 40;
    };

    const red = toRgb(r).toString(16).padStart(2, '0');
    const green = toRgb(g).toString(16).padStart(2, '0');
    const blue = toRgb(b).toString(16).padStart(2, '0');

    return `#${red}${green}${blue}`;
  }

  // Grayscale ramp (232-255)
  if (index >= 232) {
    const gray = 8 + (index - 232) * 10;
    const hex = gray.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  }

  return '#ffffff';
}

export class ANSIParser {
  // Parse ANSI codes and return styled segments
  parse(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    const currentStyle: StyleState = {};

    // Regex to match ANSI escape codes
    // biome-ignore lint/suspicious/noControlCharactersInRegex: matching the ESC control char is the point of an ANSI parser
    const ansiRegex = /\x1B\[([0-9;]*)m/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: canonical regex exec loop idiom
    while ((match = ansiRegex.exec(text)) !== null) {
      // Add text before this escape code (if any)
      if (match.index > lastIndex) {
        const segmentText = text.slice(lastIndex, match.index);
        if (segmentText.length > 0) {
          segments.push({
            text: segmentText,
            ...currentStyle,
          });
        }
      }

      // Process the escape code
      const codes = match[1].split(';').map(Number);
      this.applyCodes(codes, currentStyle);

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last escape code
    if (lastIndex < text.length) {
      const segmentText = text.slice(lastIndex);
      if (segmentText.length > 0) {
        segments.push({
          text: segmentText,
          ...currentStyle,
        });
      }
    }

    // If no segments were created, return the whole text as a single segment
    if (segments.length === 0 && text.length > 0) {
      segments.push({ text });
    }

    return segments;
  }

  // Apply ANSI codes to the current style state
  private applyCodes(codes: number[], style: StyleState): void {
    if (codes.length === 0 || (codes.length === 1 && codes[0] === 0)) {
      // Reset all styles
      style.color = undefined;
      style.backgroundColor = undefined;
      style.bold = undefined;
      style.dim = undefined;
      style.italic = undefined;
      style.underline = undefined;
      return;
    }

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];

      // Check for 256-color mode: 38;5;N (foreground) or 48;5;N (background)
      if (code === 38 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
        style.color = color256ToHex(codes[i + 2]);
        i += 2; // Skip the next two codes (5 and N)
        continue;
      }

      if (code === 48 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
        style.backgroundColor = color256ToHex(codes[i + 2]);
        i += 2; // Skip the next two codes (5 and N)
        continue;
      }

      if (code === 0) {
        // Reset
        style.color = undefined;
        style.backgroundColor = undefined;
        style.bold = undefined;
        style.dim = undefined;
        style.italic = undefined;
        style.underline = undefined;
      } else if (code === 1) {
        style.bold = true;
      } else if (code === 2) {
        style.dim = true;
      } else if (code === 3) {
        style.italic = true;
      } else if (code === 4) {
        style.underline = true;
      } else if (code === 22) {
        style.bold = undefined;
        style.dim = undefined;
      } else if (code === 23) {
        style.italic = undefined;
      } else if (code === 24) {
        style.underline = undefined;
      } else if (code === 39) {
        style.color = undefined;
      } else if (code === 49) {
        style.backgroundColor = undefined;
      } else if (ANSI_COLORS[code]) {
        style.color = ANSI_COLORS[code];
      } else if (ANSI_BG_COLORS[code]) {
        style.backgroundColor = ANSI_BG_COLORS[code];
      }
    }
  }

  // Strip all ANSI codes from text
  strip(text: string): string {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: matching the ESC control char is the point of stripping ANSI codes
    return text.replace(/\x1B\[[0-9;]*m/g, '');
  }
}
