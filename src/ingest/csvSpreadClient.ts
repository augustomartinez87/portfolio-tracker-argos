// Client-side CSV processing helper
import { ingestFromCsv, IngestResult } from './csvSpreadIngestor';

export async function processCsvClient(csvText: string): Promise<IngestResult> {
  // Reuse server-side logic adapted for client, to compute derived metrics locally
  return ingestFromCsv(csvText);
}
