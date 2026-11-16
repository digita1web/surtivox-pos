import { Linking } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { countReportHtml, countReportText, type CountReport, type ReportTextOptions } from './countReport';

export function whatsAppTextUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function shareCountReportWhatsApp(report: CountReport, opts: ReportTextOptions): Promise<void> {
  await Linking.openURL(whatsAppTextUrl(countReportText(report, opts)));
}

export async function shareCountReportPdf(report: CountReport, opts: ReportTextOptions & { dateOf: (ms: number) => string }): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: countReportHtml(report, opts) });
  const name = `conteo-inventario-${new Date().toISOString().slice(0, 10)}.pdf`;
  const named = `${FileSystem.cacheDirectory}${name}`;
  let out = uri;
  try {
    await FileSystem.deleteAsync(named, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: named });
    out = named;
  } catch {
    out = uri;
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este teléfono no permite compartir archivos');
  await Sharing.shareAsync(out, { mimeType: 'application/pdf', dialogTitle: name, UTI: 'com.adobe.pdf' });
}
