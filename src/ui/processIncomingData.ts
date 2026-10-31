import type { ANSIParser } from '../connection/ANSIParser.js';
import type { TextLogger } from '../logging/TextLogger.js';
import type { TextSegment } from '../state/AppState.js';
import type { TriggerManager } from '../triggers/TriggerManager.js';
import { splitBroadcast } from '../triggers/splitBroadcast.js';

interface IncomingDataDeps {
  ansiParser: ANSIParser;
  triggerManager: TriggerManager;
  textLogger?: TextLogger;
  display: (line: string, segments: TextSegment[]) => void;
  onError: (error: Error) => void;
}

export async function processIncomingData(data: string, deps: IncomingDataDeps): Promise<void> {
  const { ansiParser, triggerManager, textLogger, display, onError } = deps;
  // Split by newlines and emit each line separately
  const lines = data.split(/\r?\n/);
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  for (let i = 0; i < nonEmptyLines.length; i++) {
    const line = nonEmptyLines[i];
    const segments = ansiParser.parse(line);
    const plainText = ansiParser.strip(line);
    textLogger?.logRecv(plainText);

    // Display the line BEFORE its triggers run. A trigger that echoes is
    // reacting to this line, so what it prints belongs beneath it -- drawing
    // afterwards put "HIT 77" above the blow that dealt the 77.
    display(plainText, segments);

    // Process triggers with error handling and context. Triggers see a
    // glued-on BBS broadcast as its own line; the display and log keep the
    // line as the server sent it.
    const triggerLines = splitBroadcast(plainText);
    for (let j = 0; j < triggerLines.length; j++) {
      const context = {
        isLastLine: i === nonEmptyLines.length - 1 && j === triggerLines.length - 1,
      };
      await triggerManager.processLine(triggerLines[j], onError, context);
    }
  }
}
