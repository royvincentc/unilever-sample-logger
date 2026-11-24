import type { sheets_v4 } from 'googleapis';

export const PERSONNEL_FIELDS = {
  envi: { tab: 'SWAB', headers: ['SWABBED BY', 'SWAB BY'] },
  enviAnalyst: { tab: 'SWAB', headers: ['ANALYZED BY', 'ANALYST'] },
  waterSampler: { tab: 'WATER', headers: ['SAMPLED BY', 'SAMPLE BY', 'COLLECTED BY'] },
  waterAnalyst: { tab: 'WATER', headers: ['ANALYZED BY', 'ANALYST'] },
  air: { tab: 'AIR', headers: ['PERFORMED BY', 'SAMPLED BY', 'COLLECTED BY'] },
  rawReceiver: { tab: 'RM,FG,SFG', headers: ['RECEIVED / SAMPLED BY', 'RECEIVED BY', 'SAMPLED BY', 'COLLECTED BY'] },
  rawAnalyst: { tab: 'RM,FG,SFG', headers: ['ANALYZED BY', 'ANALYST'] },
} as const;

const normalizeHeader = (value: unknown) => String(value).trim().toUpperCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + (n - 1) % 26) + name;
  }
  return name;
}

export async function readPersonnel(sheets: sheets_v4.Sheets, spreadsheetId: string, year: string) {
  const lists: Record<string, string[]> = {};
  const rangeCache = new Map<string, Promise<string[]>>();
  // Typed table dropdowns are stored on the column, not on individual cells.
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(title),tables(range,columnProperties(columnIndex,dataValidationRule)))',
  });
  const tabs = [...new Set(Object.values(PERSONNEL_FIELDS).map(field => field.tab))];
  for (const tab of tabs) {
    const expectedTitle = `${tab} ${year}`;
    const findTab = (name: string) => metadata.data.sheets?.find(sheet =>
      sheet.properties?.title?.trim().toUpperCase() === name
    );
    const sheetMetadata = findTab(expectedTitle) ?? (tab === 'AIR' ? findTab(`AIR/PERSONNEL ${year}`) : undefined);
    const title = sheetMetadata?.properties?.title ?? expectedTitle;
    const quotedTitle = `'${title.replace(/'/g, "''")}'`;
    const headers = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${quotedTitle}!A1:AZ10` });
    const rows = headers.data.values ?? [];
    const fields = Object.entries(PERSONNEL_FIELDS).filter(([, field]) => field.tab === tab);
    const columns = fields.map(([key, field]) => {
      for (const row of rows) {
        const index = row.findIndex(cell => field.headers.some(header => normalizeHeader(cell) === normalizeHeader(header)));
        if (index >= 0) {
          const tableRules = (sheetMetadata?.tables ?? []).flatMap(table =>
            (table.columnProperties ?? []).filter(property =>
              (table.range?.startColumnIndex ?? 0) + (property.columnIndex ?? 0) === index
            ).flatMap(property => property.dataValidationRule?.condition?.type === 'ONE_OF_LIST' ? [property.dataValidationRule.condition] : [])
          );
          return { key, column: columnName(index), index, tableRules };
        }
      }
      throw new Error(`${title}: ${field.headers[0]} column not found. Cached names were kept.`);
    });
    const cellRanges = columns.filter(({ tableRules }) => !tableRules.length).map(({ column }) => `${quotedTitle}!${column}:${column}`);
    const grid = cellRanges.length ? await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: cellRanges,
      fields: 'sheets(data(startColumn,rowData(values(dataValidation))))',
    }) : undefined;
    for (const { key, index, tableRules } of columns) {
      const names: string[] = [];
      for (const rule of tableRules) {
        names.push(...(rule.values ?? []).map(value => value.userEnteredValue ?? ''));
      }
      for (const sheet of grid?.data.sheets ?? []) {
        // Table definitions take precedence over obsolete per-cell rules.
        if (tableRules.length) break;
        for (const data of sheet.data ?? []) {
          if ((data.startColumn ?? 0) !== index) continue;
          // Prefer the last configured row, including blank future entry rows.
          // Earlier historical rows may retain obsolete dropdown definitions.
          const rule = data.rowData?.flatMap(row => row.values ?? []).findLast(cell =>
            ['ONE_OF_LIST', 'ONE_OF_RANGE'].includes(cell.dataValidation?.condition?.type ?? '')
          )?.dataValidation?.condition;
          if (!rule) continue;
          if (rule.type === 'ONE_OF_LIST') {
            names.push(...(rule.values ?? []).map(value => value.userEnteredValue ?? ''));
          } else {
            let range = rule.values?.[0]?.userEnteredValue?.replace(/^=/, '') ?? '';
            if (!range) throw new Error(`${title}: dropdown source range is missing.`);
            // Unqualified A1 references belong to the dropdown's own tab.
            if (!range.includes('!') && /^\$?[A-Z]+\$?\d*(?::\$?[A-Z]+\$?\d*)?$/.test(range)) range = `${quotedTitle}!${range}`;
            if (!rangeCache.has(range)) {
              rangeCache.set(range, sheets.spreadsheets.values.get({ spreadsheetId, range }).then(response =>
                (response.data.values ?? []).flat().map(String)
              ));
            }
            names.push(...await rangeCache.get(range)!);
          }
        }
      }
      lists[key] = [...new Set(names.map(name => name.trim()).filter(Boolean))];
      if (!lists[key].length) throw new Error(`${title}: ${PERSONNEL_FIELDS[key as keyof typeof PERSONNEL_FIELDS].headers[0]} has no dropdown names. Cached names were kept.`);
    }
  }
  return lists;
}
