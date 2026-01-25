import { tradeService } from './tradeService';
import { parseARSNumber, parseDateDMY } from '../utils/parsers';

export interface ImportResult {
    success: boolean;
    savedCount: number;
    errorCount: number;
    message: string;
}

export const downloadTemplate = () => {
    const csvContent = `Fecha,Ticker,Cantidad,Precio
23/12/2024,MELI,10,17220
03/04/2025,MSFT,31,16075
07/04/2025,SPY,15,33800`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'portfolio_trades_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const parseAndImportTrades = (
    file: File,
    portfolioId: string,
    userId: string
): Promise<ImportResult> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                if (!text) {
                    resolve({ success: false, savedCount: 0, errorCount: 0, message: 'Archivo vacío' });
                    return;
                }

                const lines = text.split('\n').slice(1);
                const newTrades: any[] = [];

                lines.forEach((line) => {
                    if (!line.trim()) return;

                    const cols = line.split(',').map(col => col.trim());
                    const fecha = cols[0];
                    const ticker = cols[1];
                    const cantidad = cols[2];
                    const precio = cols[3];

                    if (!fecha || !ticker || ticker === 'Ticker') return;

                    const parsedDate = parseDateDMY(fecha);
                    const parsedCantidad = parseARSNumber(cantidad);
                    const parsedPrecio = parseARSNumber(precio);

                    if (parsedDate && ticker && parsedCantidad > 0) {
                        newTrades.push({
                            ticker: ticker.trim().toUpperCase(),
                            quantity: parsedCantidad,
                            price: parsedPrecio,
                            trade_date: parsedDate,
                            trade_type: 'buy', // Default to buy as per original logic? Logic implies signed quantity if selling? 
                            // Original logic had: "quantity: parsedCantidad" and "parsedCantidad > 0".
                            // It also had "trade_type: 'buy'".
                            // Wait, original: if sell, quantity is reduced. But import logic sets trade_type='buy'.
                            // Reviewing original:
                            // lines 145-153 of Dashboard.jsx:
                            // trade_type: 'buy'
                            // So import only supports Buys currently? 
                            // The template example has negative quantity? "15/01/2025,GGAL,-5,4500" (Dashboard.jsx:806)
                            // But logic says: "if (parsedDate && ticker && parsedCantidad > 0)"
                            // If parsedCantidad is negative (e.g. -5), then it is skipped!
                            // Wait, `parseARSNumber` might return positive/abs?
                            // `const parsedCantidad = parseARSNumber(cantidad);`
                            // If input is "-5", parseARSNumber likely returns -5.
                            // So currently import MIGHT NOT support sells or negative numbers properly if `parsedCantidad > 0` check exists.
                            // Line 144: `if (parsedDate && ticker && parsedCantidad > 0)`
                            // YES, the original code IGNORES negative quantities.
                            // AND hardcodes `trade_type: 'buy'`.
                            // AND calculated `total_amount: parsedCantidad * parsedPrecio`.

                            // However, the "Ejemplo" in UI (Dashboard.jsx:806) shows: `23/12/2024,MELI,10,17220` and `15/01/2025,GGAL,-5,4500`.
                            // This suggests the USER INTENDS to support Sells.
                            // BUT the current implementation (which I'm refactoring) seems to BUG/IGNORE it.
                            // As an Auditor/Refactorer, I should replicate EXISTING logic (even if buggy) OR fix it if obvious.
                            // The user asked to "extract logic".
                            // If I fix it, I might change behavior.
                            // But the UI example explicitly encourages negative numbers.
                            // I will stick to exact replication for now to be safe, but I will add a TODO or comment.
                            // Wait, look at line 147: `quantity: parsedCantidad`. 

                            // I will replicate EXACTLY what was there to avoid regressions/unexpected changes during refactor.
                            total_amount: parsedCantidad * parsedPrecio,
                            currency: 'ARS'
                        });
                    }
                });

                if (newTrades.length > 0) {
                    let savedCount = 0;
                    let errorCount = 0;
                    let lastError: any = null;

                    for (const trade of newTrades) {
                        try {
                            // The Create Trade service likely handles validation
                            await tradeService.createTrade(portfolioId, userId, trade);
                            savedCount++;
                        } catch (err) {
                            console.error('Error saving trade:', trade.ticker, err);
                            lastError = err;
                            errorCount++;
                        }
                    }

                    if (savedCount > 0) {
                        resolve({
                            success: true,
                            savedCount,
                            errorCount,
                            message: `✓ ${savedCount} transacciones importadas${errorCount > 0 ? ` (${errorCount} fallidas: ${lastError?.message || 'error'})` : ''}`
                        });
                    } else {
                        resolve({
                            success: false,
                            savedCount: 0,
                            errorCount,
                            message: `Error al guardar transacciones: ${lastError?.message || 'Error desconocido'}`
                        });
                    }
                } else {
                    resolve({
                        success: false,
                        savedCount: 0,
                        errorCount: 0,
                        message: 'No se encontraron transacciones válidas'
                    });
                }
            } catch (error: any) {
                console.error('Error importing CSV:', error);
                resolve({
                    success: false,
                    savedCount: 0,
                    errorCount: 0,
                    message: 'Error al importar archivo' // Matches original catch block message
                });
            }
        };

        reader.onerror = () => {
            resolve({
                success: false,
                savedCount: 0,
                errorCount: 0,
                message: 'Error al leer archivo'
            });
        };

        reader.readAsText(file);
    });
};
