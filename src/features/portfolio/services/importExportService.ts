import { tradeService } from './tradeService';
import { parseARSNumber, parseDateDMY } from '@/utils/parsers';

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
                    const dateStr = cols[0];
                    const ticker = cols[1];
                    const quantityRaw = cols[2];
                    const priceRaw = cols[3];

                    if (!dateStr || !ticker || ticker === 'Ticker') return;

                    const parsedDate = parseDateDMY(dateStr);
                    const parsedQuantity = parseARSNumber(quantityRaw);
                    const parsedPrice = parseARSNumber(priceRaw);

                    if (parsedDate && ticker && parsedQuantity !== 0) {
                        const absQuantity = Math.abs(parsedQuantity);
                        const tradeType = parsedQuantity > 0 ? 'buy' : 'sell';

                        newTrades.push({
                            ticker: ticker.trim().toUpperCase(),
                            quantity: absQuantity,
                            price: parsedPrice,
                            trade_date: parsedDate,
                            trade_type: tradeType,
                            total_amount: absQuantity * parsedPrice,
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
                    message: 'Error al importar archivo'
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
