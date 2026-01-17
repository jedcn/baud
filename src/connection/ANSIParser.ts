import type { TextSegment } from '../state/AppState.js';

interface StyleState {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

// ANSI color codes to Ink color names
const ANSI_COLORS: Record<number, string> = {
  30: 'black',
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'white',
  90: 'gray',
  91: 'redBright',
  92: 'greenBright',
  93: 'yellowBright',
  94: 'blueBright',
  95: 'magentaBright',
  96: 'cyanBright',
  97: 'whiteBright',
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: 'bgBlack',
  41: 'bgRed',
  42: 'bgGreen',
  43: 'bgYellow',
  44: 'bgBlue',
  45: 'bgMagenta',
  46: 'bgCyan',
  47: 'bgWhite',
  100: 'bgGray',
  101: 'bgRedBright',
  102: 'bgGreenBright',
  103: 'bgYellowBright',
  104: 'bgBlueBright',
  105: 'bgMagentaBright',
  106: 'bgCyanBright',
  107: 'bgWhiteBright',
};

export class ANSIParser {
  // Parse ANSI codes and return styled segments
  parse(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    const currentStyle: StyleState = {};

    // Regex to match ANSI escape codes
    const ansiRegex = /\x1B\[([0-9;]*)m/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

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

    for (const code of codes) {
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
    return text.replace(/\x1B\[[0-9;]*m/g, '');
  }
}
