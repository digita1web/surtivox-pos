import { fileURLToPath } from 'node:url';
import { buildTaxonomy, readTaxonomyFiles } from '../src/taxonomy.ts';
import type { Taxonomy } from '../src/types.ts';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

export const TEST_SOURCES = [
  { id: 'prueba', name: 'Fuente de prueba', url: 'https://example.org/prueba', license: 'ODbL-1.0', attribution: '© Prueba, ODbL', status: 'approved' },
  { id: 'abierta', name: 'Fuente CC0', url: 'https://example.org/cc0', license: 'CC0-1.0', attribution: '', status: 'approved' },
  { id: 'pendiente', name: 'Fuente pendiente', url: 'https://example.org/pendiente', license: 'CC0-1.0', attribution: '', status: 'pending' },
  { id: 'vetada', name: 'Fuente rechazada', url: 'https://example.org/vetada', license: 'CC-BY-SA-4.0', attribution: '© Vetada', status: 'rejected' },
];

export function testTaxonomy(): Taxonomy {
  const files = readTaxonomyFiles(ROOT);
  const { taxonomy, issues } = buildTaxonomy({ ...files, sources: TEST_SOURCES });
  if (issues.length) throw new Error(JSON.stringify(issues));
  return taxonomy;
}

export function product(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'prueba:arroz-diana-500',
    name: 'Arroz Diana 500 g',
    brand: 'Diana',
    category: 'granos',
    unit: 'unit',
    presentation: { quantity: 500, unit: 'g' },
    synonyms: ['Arroz blanco'],
    barcodes: ['7702511000045'],
    business_types: ['tienda', 'minimercado'],
    source: { id: 'prueba', ref: 'abc-1', retrieved_at: '2026-11-16' },
    license: 'ODbL-1.0',
    ...overrides,
  };
}
