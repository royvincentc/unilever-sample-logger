import test from 'node:test';
import assert from 'node:assert/strict';
import { generateShiftSummary, getShiftWindow, getDefaultShift, splitTelegramText } from '../src/utils/shiftSummary.ts';

test('shift windows use Taipei time, exclusive ends, and overnight year rollover', () => {
  const am = getShiftWindow('2026-10-28', 'AM');
  assert.equal(am.start.toISOString(), '2026-10-27T22:00:00.000Z');
  assert.equal(am.end.toISOString(), '2026-10-28T10:00:00.000Z');
  const pm = getShiftWindow('2026-12-31', 'PM');
  assert.equal(pm.end.toISOString(), '2026-12-31T22:00:00.000Z');
  assert.throws(() => getShiftWindow('2026-02-30', 'AM'));
  assert.throws(() => getShiftWindow('', 'PM'));
  assert.deepEqual(getDefaultShift(new Date('2026-11-05T05:59:00+08:00')), { date: '2026-11-04', shift: 'PM' });
  assert.deepEqual(getDefaultShift(new Date('2026-11-05T06:00:00+08:00')), { date: '2026-11-05', shift: 'AM' });
});

test('AM includes 06:00 but excludes assigned 18:00 activity and groups by the requested personnel', () => {
  const report = generateShiftSummary({
    ENVI: [{ 'DATE SWABBED': '10/28/2026', 'TIME SWABBED': '6:00 AM', SAMPLE: 'ST3', 'ANALYZED BY': 'ROY', 'SWABBED BY': 'OTHER' }],
    WATER: [
      { 'DATE SAMPLED': '2026-10-28', 'TIME SAMPLED': '02:59', 'WATER SOURCE': 'Too early', 'ANALYZED BY': 'DCN', 'SAMPLED BY': 'SAMPLER' },
      { 'DATE SAMPLED': '2026-10-28', 'TIME SAMPLED': '10:09\u202fAM', 'WATER SOURCE': 'QCL Chlorine Water', 'ANALYZED BY': 'DCN', 'SAMPLED BY': 'SAMPLER' },
      { 'DATE SAMPLED': '2026-10-28', 'TIME SAMPLED': '11:00', 'WATER SOURCE': 'Chlorine Tank 2', 'ANALYZED BY': 'AFC', 'SAMPLED BY': 'SAMPLER' },
      { 'DATE SAMPLED': '2026-10-28', 'TIME SAMPLED': '18:00', 'WATER SOURCE': 'Next shift', 'ANALYZED BY': 'ROY' },
    ],
    RawMats: [
      { 'DATE RECEIVED/SAMPLED': '10/28/2026', TIME: '06:38', SAMPLE: 'SLD CB', 'BATCH #': '2810261A1', 'ANALYZED BY': 'ROY', 'RECEIVED BY': 'OTHER' },
      { ' date received ': '10/28/2026', ' time received ': '06:32', sample: 'SFC BF', 'MIXING BATCH #': '2810261A2', 'ANALYZED BY': ' - ', 'RECEIVED BY': 'DCN' },
    ],
  }, '2026-10-28', 'AM', new Date('2026-10-28T18:00:00+08:00'));
  assert.match(report.text, /^Good evening!\n\n10\/28\/2026\n\nENVI\n/);
  assert.match(report.text, /ENVI\nST3 @ 6:00 AM\n\u2014 ROY \u2014/);
  assert.match(report.text, /QCL Chlorine Water @ 10:09 AM\n\u2014 DCN \u2014/);
  assert.match(report.text, /RM,FG,SFG/);
  assert.match(report.text, /SLD CB : 2810261A1 @ 6:38 AM\n\u2014 ROY \u2014/);
  assert.match(report.text, /SFC BF : 2810261A2 @ 6:32 AM\n\u2014 DCN \u2014/);
  assert.doesNotMatch(report.text, /Too early|Next shift|OTHER/);
  assert.equal(report.count, 5);
  assert.deepEqual(report.warnings, []);
});

test('PM includes next-day early morning activity, midnight, and handover instructions', () => {
  const rows = [
    { 'DATE SAMPLED': '12/31/2026', 'TIME SAMPLED': '18:00', 'WATER SOURCE': 'Start', 'ANALYZED BY': 'AFC', 'SAMPLED BY': 'SAMPLER', STATUS: 'ON GOING' },
    { 'DATE SAMPLED': '1/1/2027', 'TIME SAMPLED': '12:00 AM', 'WATER SOURCE': 'Midnight', 'ANALYZED BY': 'AFC', 'SAMPLED BY': 'SAMPLER' },
    { 'DATE SAMPLED': '1/1/2027', 'TIME SAMPLED': '5:59 AM', 'WATER SOURCE': 'Handover', 'ANALYZED BY': 'AFC', 'SAMPLED BY': 'SAMPLER', REMARKS: 'Endorse to Dayshift' },
    { 'DATE SAMPLED': '1/1/2027', 'TIME SAMPLED': '06:00', 'WATER SOURCE': 'Excluded', 'ANALYZED BY': 'AFC' },
  ];
  const report = generateShiftSummary({ WATER: rows }, '2026-12-31', 'PM');
  assert.equal(report.count, 3);
  assert.match(report.text, /Start @ 6:00 PM\nMidnight @ 12:00 AM\n\u2014 AFC \u2014/);
  assert.match(report.text, /Endorse to Dayshift\n\nWater\nHandover @ 5:59 AM \(Endorse to Dayshift\)\n\u2014 AFC \u2014/);
  assert.doesNotMatch(report.text, /Excluded/);
});

test('handover instructions and recipient details survive moving to the endorsement section', () => {
  const report = generateShiftSummary({ WATER: [{
    'DATE SAMPLED': '10/28/2026', 'TIME SAMPLED': '5:30 PM',
    'WATER SOURCE': 'Tank 2', 'ANALYZED BY': 'AFC', 'SAMPLED BY': 'SAMPLER', 'ENDORSED TO': 'ROY',
    REMARKS: 'Endorsed to Night Shift; repeat coliform test before release',
  }] }, '2026-10-28', 'AM');
  assert.match(report.text, /Endorse to Night Shift\n\nWater/);
  assert.match(report.text, /Endorsed to ROY/);
  assert.match(report.text, /repeat coliform test before release/);
});

test('invalid/missing times warn rather than becoming midnight; late samples are endorsed', () => {
  const report = generateShiftSummary({
    ENVI: [
      { 'DATE SWABBED': '2026-10-28', SAMPLE: 'Missing time' },
      { 'DATE SWABBED': '2026-10-28', 'TIME SWABBED': '25:00', SAMPLE: 'Bad time' },
      { 'DATE SWABBED': '2026-10-27', SAMPLE: 'Old missing time' },
      { 'DATE SWABBED': '2026-10-28', 'TIME SWABBED': '17:10', SAMPLE: 'ST3', 'SWABBED BY': '-', STATUS: 'ON GOING' },
    ],
  }, '2026-10-28', 'AM');
  assert.equal(report.count, 1);
  assert.doesNotMatch(report.text, /\u2014 Unspecified \u2014/);
  assert.match(report.text, /Endorse to Night Shift/);
  assert.equal(report.warnings.length, 1);
  assert.match(report.warnings[0], /2/);
});

test('Water uses the analyst and leaves missing analysts unspecified', () => {
  const report = generateShiftSummary({ WATER: [
    { 'DATE SAMPLED': '11/04/2026', TIME: '10:30 AM', 'WATER SOURCE': 'Tank 2', 'SAMPLED BY': 'SAMPLER', 'ANALYZED BY': 'CANOY' },
    { 'DATE SAMPLED': '11/04/2026', TIME: '1:25 PM', 'WATER SOURCE': 'Tank 1', 'SAMPLED BY': 'SAMPLER', 'ANALYZED BY': '-' },
  ] }, '2026-11-04', 'AM');
  assert.match(report.text, /Tank 2 @ 10:30 AM\n\u2014 CANOY \u2014/);
  assert.match(report.text, /Tank 1 @ 1:25 PM\n\u2014 Unspecified \u2014/);
  assert.doesNotMatch(report.text, /SAMPLER/);
});

test('ENVI compresses equipment points only at the same time, analyst and endorsement', () => {
  const swab = (sample: string, time = '7:05 AM', person = 'CANOY/LLOYD', remarks = '') => ({
    SAMPLE: sample, 'DATE SWABBED': '11/04/2026', 'TIME SWABBED': time, 'ANALYZED BY': person, 'SWABBED BY': 'OTHER', REMARKS: remarks,
  });
  const report = generateShiftSummary({ ENVI: [
    swab('LEEPACK DOME'), swab('LEEPACK BODY'),
    swab('Storage Tank 3  - Inner Dome', '4:12 PM'), swab('ST3 - Body', '4:12 PM'),
    swab('Storage Tank 2  - Inner Dome', '4:12 PM'), swab('Storage Tank 2 - Body', '4:12 PM'),
    swab('LEEPACK NOZZLE 1', '8:05 AM'),
    swab('LEEPACK JOINT 1', '7:05 AM', 'ROY'),
    swab('LEEPACK BODY', '7:05 AM', 'CANOY/LLOYD', 'Endorse to Night Shift; repeat test'),
    swab('LEEPACK DOME', '7:05 AM', 'CANOY/LLOYD', 'Endorse to Night Shift; check nozzle'),
    swab('Unknown equipment - Inner Dome'), swab('Unknown equipment - Outer Dome'),
  ], RawMats: [
    { SAMPLE: 'LEEPACK BODY', 'DATE RECEIVED/SAMPLED': '11/04/2026', TIME: '7:05 AM', 'ANALYZED BY': 'ROY' },
    { SAMPLE: 'LEEPACK BODY', 'DATE RECEIVED/SAMPLED': '11/04/2026', TIME: '7:05 AM', 'ANALYZED BY': 'ROY' },
  ] }, '2026-11-04', 'AM');
  assert.equal(report.count, 14);
  const envi = report.text.split('RM,FG,SFG')[0];
  assert.equal(envi.split('\n').filter(line => line.startsWith('Leepack') && line.includes('@ 7:05 AM')).length, 2);
  assert.equal(report.text.split('\n').filter(line => line === 'ST3, ST2 @ 4:12 PM').length, 1);
  assert.match(envi, /Leepack @ 8:05 AM/);
  assert.match(envi, /Leepack @ 7:05 AM\n\u2014 ROY \u2014/);
  assert.match(envi, /Unknown equipment - Inner Dome/);
  assert.match(envi, /Unknown equipment - Outer Dome/);
  assert.match(report.text, /Endorse to Night Shift; repeat test/);
  assert.match(report.text, /Endorse to Night Shift; check nozzle/);
  assert.equal(report.text.split('\n').filter(line => line === 'LEEPACK BODY @ 7:05 AM').length, 2);
});

test('Akash swab points compress by machine while preserving times, analysts and handover notes', () => {
  const swab = (SAMPLE: string, time = '3:05 AM', analyst = 'CODINERA', remarks = '') => ({
    SAMPLE, 'DATE SWABBED': '11/05/2026', 'TIME SWABBED': time, 'ANALYZED BY': analyst, REMARKS: remarks,
  });
  const rows = { ENVI: [
    swab('AKASH 1 HOPPER COVER OUTER DOME'), swab('AKASH 1 HOPPER BODY'),
    swab('akash 1 nozzle 6'), swab('AKASH 2 NOZZLE 1'), swab('AKASH 11 NOZZLE 1'),
    swab('AKASH 1 NOZZLE 1', '3:15 AM'),
    swab('AKASH 1 NOZZLE 2', '3:05 AM', 'ROY'),
    swab('AKASH 1 NOZZLE 3', '3:05 AM', 'CODINERA', 'Hold pending retest'),
  ] };
  for (const shift of ['AM', 'PM'] as const) {
    const report = generateShiftSummary(rows, shift === 'AM' ? '2026-11-05' : '2026-11-04', shift);
    const received = shift === 'AM' ? ' (Endorsed by Night Shift)' : '';
    assert.equal(report.count, 8);
    assert.equal(report.text.split('\n').filter(line => line === `Akash 1 @ 3:05 AM${received}`).length, 1);
    assert.ok(report.text.includes(`Akash 1, Akash 2, Akash 11 @ 3:05 AM${received}`));
    assert.match(report.text, /Akash 1 @ 3:15 AM/);
    assert.match(report.text, /Hold pending retest/);
    assert.doesNotMatch(report.text, /HOPPER|NOZZLE/);
  }
});

test('material names abbreviate product families and separate batches without merging samples', () => {
  const material = (SAMPLE: string, batch = '', time = '9:26 AM') => ({
    SAMPLE, 'BATCH #': batch, 'DATE RECEIVED/SAMPLED': '11/05/2026', TIME: time, 'ANALYZED BY': 'CODINERA',
  });
  const report = generateShiftSummary({ RawMats: [
    material('Surf Liquid Detergent - Cherry Blossom', 'CB02-051126'),
    material('Surf Liquid Detergent - Cherry Blossom', 'CB02-051126', '9:48 AM'),
    material('surf fabric conditioner - Blossom Fresh', '0511261A1 I 06:18'),
    material('Surf Liquid Detergent - Rose Fresh'),
    material('Other product', 'OTHER-1'),
    { ...material('Surf Fabric Conditioner - Luxe Perfume', 'LP01-051126', '3:00 AM'), REMARKS: 'Hold pending retest' },
  ], WATER: [{
    'WATER SOURCE': 'Surf Liquid Detergent rinse', 'DATE SAMPLED': '11/05/2026', TIME: '10:00 AM', 'ANALYZED BY': 'CODINERA',
  }] }, '2026-11-05', 'AM');
  assert.equal(report.count, 7);
  assert.match(report.text, /SLD - Cherry Blossom : CB02-051126 @ 9:26 AM/);
  assert.match(report.text, /SLD - Cherry Blossom : CB02-051126 @ 9:48 AM/);
  assert.match(report.text, /SFC - Blossom Fresh : 0511261A1 I 06:18 @ 9:26 AM/);
  assert.match(report.text, /SLD - Rose Fresh @ 9:26 AM/);
  assert.match(report.text, /Other product : OTHER-1 @ 9:26 AM/);
  assert.match(report.text, /SFC - Luxe Perfume : LP01-051126 @ 3:00 AM \(Hold pending retest; Endorsed by Night Shift\)/);
  assert.match(report.text, /Water\nSurf Liquid Detergent rinse @ 10:00 AM/);
});

test('repeated material names and batches show their sources across analysts and endorsements', () => {
  const material = (source: string, batch = 'CB01-051126', time = '6:39 AM', analyst = 'CODINERA') => ({
    SAMPLE: 'Surf Liquid Detergent - Cherry Blossom', SOURCE: source, 'BATCH #': batch,
    'DATE RECEIVED/SAMPLED': '11/05/2026', TIME: time, 'ANALYZED BY': analyst,
  });
  const report = generateShiftSummary({ RawMats: [
    material('MX Sampling Port 1'),
    material('Storage Tank 4', 'CB01-051126', '7:08 AM'),
    material('MX Sampling Port 2', 'CB02-051126'),
    material('Storage Tank 3', 'CB02-051126', '3:05 AM', 'ROY'),
    material('IBC TANK', 'CB02-051126', '3:15 PM'),
    material('', 'CB02-051126', '10:00 AM'),
    material('Storage Tank 2', 'UNIQUE'),
    material('Storage Tank 1', 'UNIQUE', '6:00 PM'),
    material('Storage Tank 1', 'UNIQUE', 'invalid'),
    { ...material('Storage Tank 1', 'UNIQUE'), SAMPLE: 'Surf Fabric Conditioner - Cherry Blossom' },
  ] }, '2026-11-05', 'AM');
  assert.equal(report.count, 8);
  assert.match(report.text, /SLD - Cherry Blossom \(MX-SP1\) : CB01-051126 @ 6:39 AM/);
  assert.match(report.text, /SLD - Cherry Blossom \(ST4\) : CB01-051126 @ 7:08 AM/);
  assert.match(report.text, /SLD - Cherry Blossom \(MX-SP2\) : CB02-051126 @ 6:39 AM/);
  assert.match(report.text, /SLD - Cherry Blossom \(ST3\) : CB02-051126 @ 3:05 AM \(Endorsed by Night Shift\)/);
  assert.match(report.text, /SLD - Cherry Blossom \(IBC TANK\) : CB02-051126 @ 3:15 PM/);
  assert.match(report.text, /SLD - Cherry Blossom : CB02-051126 @ 10:00 AM/);
  assert.match(report.text, /SLD - Cherry Blossom : UNIQUE @ 6:39 AM/);
  assert.match(report.text, /SFC - Cherry Blossom : UNIQUE @ 6:39 AM/);
  assert.doesNotMatch(report.text, /\(\)|\(ST2\)|\(ST1\)/);
});

test('ENVI without an analyst stays unspecified rather than using the swabber', () => {
  const report = generateShiftSummary({ ENVI: [{
    SAMPLE: 'LEEPACK DOME', 'DATE SWABBED': '11/04/2026', 'TIME SWABBED': '7:05 AM',
    'ANALYZED BY': '-', 'SWABBED BY': 'SWABBER',
  }] }, '2026-11-04', 'AM');
  assert.match(report.text, /Leepack @ 7:05 AM\n\u2014 Unspecified \u2014/);
  assert.doesNotMatch(report.text, /SWABBER/);
});

for (const shift of ['AM', 'PM'] as const) {
  test(`${shift} endorses all categories in the last three hours and receives the previous handover`, () => {
    const date = shift === 'AM' ? '2027-01-01' : '2026-12-31';
    const nextDate = shift === 'AM' ? date : '2027-01-01';
    const times = shift === 'AM'
      ? ['02:59:59', '03:00', '05:59:59', '06:00', '14:59:59', '15:00', '17:59:59', '18:00']
      : ['14:59:59', '15:00', '17:59:59', '18:00', '02:59:59', '03:00', '05:59:59', '06:00'];
    const names = ['Excluded before', 'Incoming start', 'Incoming end', 'Shift start', 'Before outgoing', 'Outgoing start', 'Outgoing end', 'Excluded end'];
    const rows = Object.fromEntries(['ENVI', 'WATER', 'RawMats'].map(type => [type, times.map((time, i) => ({
      SAMPLE: names[i], 'WATER SOURCE': names[i],
      [type === 'ENVI' ? 'DATE SWABBED' : type === 'WATER' ? 'DATE SAMPLED' : 'DATE RECEIVED/SAMPLED']: i >= 4 ? nextDate : date,
      [type === 'ENVI' ? 'TIME SWABBED' : 'TIME']: time,
      'ANALYZED BY': 'ROY',
    }))]));
    const report = generateShiftSummary(rows, date, shift);
    const source = shift === 'AM' ? 'Night Shift' : 'Dayshift';
    const destination = shift === 'AM' ? 'Night Shift' : 'Dayshift';
    assert.equal(report.count, 18);
    assert.doesNotMatch(report.text, /Excluded before|Excluded end/);
    const [normal, outgoing] = report.text.split(`Endorse to ${destination}\n`);
    assert.ok(outgoing);
    assert.equal(normal.match(new RegExp(`\\(Endorsed by ${source}\\)`, 'g'))?.length, 6);
    for (const category of ['ENVI', 'Water', 'RM,FG,SFG']) {
      assert.ok(normal.includes(`${category}\n`));
      assert.ok(outgoing.includes(`${category}\n`));
    }
    assert.doesNotMatch(normal, /Outgoing start|Outgoing end/);
    assert.doesNotMatch(outgoing, /Incoming start|Incoming end|Before outgoing|Shift start/);
    assert.equal(outgoing.match(/Outgoing start/g)?.length, 3);
    assert.equal(outgoing.match(/Outgoing end/g)?.length, 3);

    // A source-shift report sees the same incoming rows as outgoing handovers.
    const previousDate = shift === 'AM' ? '2026-12-31' : date;
    const previous = generateShiftSummary(rows, previousDate, shift === 'AM' ? 'PM' : 'AM');
    const previousOutgoing = previous.text.split(`Endorse to ${shift === 'AM' ? 'Dayshift' : 'Night Shift'}\n`)[1];
    assert.ok(previousOutgoing);
    assert.equal(previousOutgoing.match(/Incoming start/g)?.length, 3);
    assert.equal(previousOutgoing.match(/Incoming end/g)?.length, 3);
    assert.doesNotMatch(previousOutgoing, /Endorsed by/);
    assert.deepEqual(report.warnings, []);
  });
}

test('incoming endorsements keep the recorded recipient and handover instructions', () => {
  const rows = { WATER: [{
    'DATE SAMPLED': '1/1/2027', TIME: '3:00 AM', 'WATER SOURCE': 'Tank 2',
    'ANALYZED BY': 'ROY', 'ENDORSED TO': 'DCN',
    REMARKS: 'Endorsed to Dayshift; repeat coliform test',
  }] };
  const outgoing = generateShiftSummary(rows, '2026-12-31', 'PM');
  const incoming = generateShiftSummary(rows, '2027-01-01', 'AM');
  for (const report of [outgoing, incoming]) {
    assert.equal(report.count, 1);
    assert.match(report.text, /Endorsed to DCN/);
    assert.match(report.text, /Endorsed to Dayshift; repeat coliform test/);
  }
  assert.match(outgoing.text, /Endorse to Dayshift\n\nWater/);
  assert.match(incoming.text, /repeat coliform test; Endorsed by Night Shift/);
  assert.doesNotMatch(incoming.text, /Endorse to Night Shift\n/);
});

test('automatic handovers preserve notes without endorsement keywords and keep distinct instructions', () => {
  const rows = { ENVI: ['Hold pending retest', 'Continue incubation'].map(REMARKS => ({
    SAMPLE: 'LEEPACK BODY', 'DATE SWABBED': '11/04/2026', 'TIME SWABBED': '4:12 PM',
    'ANALYZED BY': 'ROY', REMARKS,
  })) };
  for (const shift of ['AM', 'PM'] as const) {
    const report = generateShiftSummary(rows, '2026-11-04', shift);
    assert.equal(report.count, 2);
    assert.equal(report.text.match(/Leepack @ 4:12 PM/g)?.length, 2);
    assert.match(report.text, /Hold pending retest/);
    assert.match(report.text, /Continue incubation/);
  }
});

test('outgoing ENVI compresses equipment and omits missing analysts without losing sample counts', () => {
  const names = [
    'Side Pot 1 - Inner Dome', 'Side Pot 1 - Outer Dome', 'Side Pot 1 - Body', 'Side Pot 1 - Stirrer',
    'Premixing tank 1 - Inner Dome', 'PM1 BALL', 'PM1 IN FLEXIBLE HOSE',
    'Premixing tank 2 - Inner Dome', 'PM2 OUT FLEXIBLE HOSE', 'Premixing tank 2 Pump Filter - Top',
    'Premixing tank 2 Pump Filter - Bottom', 'Premixing tank 3 - Body', 'Premixing tank 4 - Stirrer',
    'Main Mixing Tank 1 - Inner Dome', 'Main Mixing Tank 1 - Sampling Port 2', 'Main Mixing Tank 1 Filter - Bottom',
  ];
  for (const shift of ['AM', 'PM'] as const) {
    const rows = { ENVI: names.map(SAMPLE => ({
      SAMPLE, 'DATE SWABBED': '11/05/2026', 'TIME SWABBED': shift === 'AM' ? '5:30 PM' : '5:30 AM',
      'ANALYZED BY': '-', 'SWABBED BY': 'SWABBER',
    })) };
    const report = generateShiftSummary(rows, shift === 'AM' ? '2026-11-05' : '2026-11-04', shift);
    const destination = shift === 'AM' ? 'Night Shift' : 'Dayshift';
    const time = shift === 'AM' ? '5:30 PM' : '5:30 AM';
    assert.equal(report.count, names.length);
    assert.ok(report.text.includes(`Endorse to ${destination}\n\nENVI\nSP1, PM1, PM2, PM3, PM4, MX01 @ ${time}\n\nThank you`));
    assert.doesNotMatch(report.text, /Unspecified|SWABBER|HOPPER|Inner Dome|BALL|Filter/);
    const incoming = generateShiftSummary(rows, '2026-11-05', shift === 'AM' ? 'PM' : 'AM');
    assert.equal(incoming.count, names.length);
    const source = shift === 'AM' ? 'Dayshift' : 'Night Shift';
    assert.ok(incoming.text.includes(`SP1, PM1, PM2, PM3, PM4, MX01 @ ${time} (Endorsed by ${source})\n\u2014 Unspecified \u2014`));
    const assigned = generateShiftSummary({
      ENVI: rows.ENVI.map(row => ({ ...row, 'ANALYZED BY': 'Roy' })),
    }, '2026-11-05', shift === 'AM' ? 'PM' : 'AM');
    assert.equal(assigned.count, names.length);
    assert.ok(assigned.text.includes(`SP1, PM1, PM2, PM3, PM4, MX01 @ ${time} (Endorsed by ${source})\n\u2014 Roy \u2014`));
  }
});

test('received ENVI groups machine points while preserving different times, analysts and notes', () => {
  const swab = (SAMPLE: string, time = '5:30 PM', analyst = 'Roy', remarks = '') => ({
    SAMPLE, 'DATE SWABBED': '11/05/2026', 'TIME SWABBED': time, 'ANALYZED BY': analyst, REMARKS: remarks,
  });
  const report = generateShiftSummary({ ENVI: [
    swab('Side Pot 1 - Inner Dome'), swab('Side Pot 1 - Outer Dome'),
    swab('Side Pot 1 - Body'), swab('Side Pot 1 - Stirrer'),
    swab('Side Pot 2 - Body'), swab('Premixing tank 1 - Body'),
    swab('Premixing tank 2 - Body', '5:31 PM'),
    swab('Premixing tank 3 - Body', '5:30 PM', 'CANOY'),
    swab('Premixing tank 4 - Body', '5:30 PM', 'Roy', 'Hold pending retest'),
    swab('Main Mixing Tank 1 Filter - Top', '5:30 PM', 'Roy', 'Continue incubation'),
  ] }, '2026-11-05', 'PM');
  assert.equal(report.count, 10);
  assert.match(report.text, /SP1, SP2, PM1 @ 5:30 PM \(Endorsed by Dayshift\)/);
  assert.match(report.text, /PM2 @ 5:31 PM \(Endorsed by Dayshift\)\n\u2014 Roy \u2014/);
  assert.match(report.text, /PM3 @ 5:30 PM \(Endorsed by Dayshift\)\n\u2014 CANOY \u2014/);
  assert.match(report.text, /PM4 @ 5:30 PM \(Hold pending retest; Endorsed by Dayshift\)/);
  assert.match(report.text, /MX01 @ 5:30 PM \(Continue incubation; Endorsed by Dayshift\)/);
  assert.doesNotMatch(report.text, /Inner Dome|Outer Dome|Stirrer|Filter|Endorse to Night Shift/);
});

test('outgoing compression keeps different times, analysts and instructions separate', () => {
  const swab = (SAMPLE: string, time = '5:30 PM', analyst = '', remarks = '') => ({
    SAMPLE, 'DATE SWABBED': '11/05/2026', 'TIME SWABBED': time, 'ANALYZED BY': analyst, REMARKS: remarks,
  });
  const report = generateShiftSummary({ ENVI: [
    swab('Side Pot 1 - Body'), swab('Premixing tank 1 - Body'),
    swab('Premixing tank 2 - Body', '5:31 PM'),
    swab('Premixing tank 3 - Body', '5:30 PM', 'ROY'),
    swab('Premixing tank 4 - Body', '5:30 PM', '', 'Hold pending retest'),
    swab('Main Mixing Tank 1 Filter - Top', '5:30 PM', '', 'Continue incubation'),
    swab('Side Pot 1 - Outer Dome', '7:00 AM'),
  ], WATER: [{
    'WATER SOURCE': 'Tank 2', 'DATE SAMPLED': '11/05/2026', TIME: '5:30 PM',
  }], RawMats: [{
    SAMPLE: 'SLD', 'DATE RECEIVED/SAMPLED': '11/05/2026', TIME: '5:30 PM',
  }] }, '2026-11-05', 'AM');
  const [normal, outgoing] = report.text.split('Endorse to Night Shift\n');
  assert.match(normal, /SP1 @ 7:00 AM\n\u2014 Unspecified \u2014/);
  assert.match(outgoing, /SP1, PM1 @ 5:30 PM/);
  assert.match(outgoing, /PM2 @ 5:31 PM/);
  assert.match(outgoing, /PM3 @ 5:30 PM\n\u2014 ROY \u2014/);
  assert.match(outgoing, /PM4 @ 5:30 PM \(Hold pending retest\)/);
  assert.match(outgoing, /MX01 @ 5:30 PM \(Continue incubation\)/);
  assert.match(outgoing, /Water\nTank 2 @ 5:30 PM/);
  assert.match(outgoing, /RM,FG,SFG\nSLD @ 5:30 PM/);
  assert.doesNotMatch(outgoing, /Unspecified/);
  assert.equal(report.count, 9);
});

test('regular ENVI compresses partial equipment families and name variants within each control', () => {
  const names = [
    'Side Pot 1 - Inner Dome', 'side-pot 01 - modified swabpoint', 'SP1 Stirrer',
    'SidePot2 - Body', 'Premixing tank 1 - Inner Dome', 'PM1 BALL',
    'PM1 T-SHAPE CONNECTING METAL', 'PM1 IN FLEXIBLE HOSE', 'PM1 OUT FLEXIBLE HOSE', 'PMI - Outer Dome',
    'pre mixing tank 2 Pump Filter - Top', 'PM02 Bottom',
    'Premix Tank 3 - Body', 'Premixing tank 4 - Stirrer',
    'Main Mixing Tank 1 - Sampling Port 1', 'MX-01 Filter - Bottom',
    'Storage Tank 1 - Inner Dome', 'Storage Tank 2- Outer Dome',
    'ST03 Body', 'storage tank 4 - Body',
    'AKASH1 HOPPER BODY', 'akash 01 nozzle 6', 'AKASH 2 NOZZLE 1',
    'LEEPACK DOME', 'Leepack Hose 4', 'LEEPAK COH 1',
  ];
  for (const shift of ['AM', 'PM'] as const) {
    const time = shift === 'AM' ? '10:00 AM' : '8:15 PM';
    const report = generateShiftSummary({ ENVI: names.map(SAMPLE => ({
      SAMPLE, 'CONTROL #': 'PRIVATE-CONTROL', 'DATE SWABBED': '11/10/2026',
      'TIME SWABBED': time, 'ANALYZED BY': 'GOLORAN',
    })) }, '2026-11-10', shift);
    assert.ok(report.text.includes(`ENVI\nSP1, SP2, PM1, PM2, PM3, PM4, MX01, ST1, ST2, ST3, ST4, Akash 1, Akash 2, Leepack @ ${time}\n\u2014 GOLORAN \u2014`));
    assert.equal(report.text.match(/ @ /g)?.length, 1);
    assert.equal(report.count, names.length);
    assert.deepEqual(report.warnings, []);
    assert.doesNotMatch(report.text, /PRIVATE-CONTROL|Inner Dome|Hose|COH/);
  }
});

test('ENVI keeps controls separate even at identical times and never prints control identifiers', () => {
  const swab = (SAMPLE: string, control: string, time = '10:00 AM', person = 'ROY', remarks = '') => ({
    SAMPLE, 'CONTROL #': control, 'DATE SWABBED': '11/10/2026',
    'TIME SWABBED': time, 'ANALYZED BY': person, REMARKS: remarks,
  });
  const report = generateShiftSummary({ ENVI: [
    swab('Side Pot 1 - Body', 'SECRET-1'), swab('SP1 Inner Dome', 'secret-1'),
    swab('PM1 BALL', 'SECRET-1'),
    swab('Side Pot 1 - Body', 'SECRET-2'), swab('SP1 Stirrer', 'SECRET-2'),
    swab('SP1 Body', 'SECRET-1', '10:15 AM'),
    swab('SP1 Body', 'SECRET-1', '10:00 AM', 'CANOY'),
    swab('SP1 Body', 'SECRET-1', '10:00 AM', 'ROY', 'Hold pending retest'),
    swab('', 'SECRET-3'),
  ] }, '2026-11-10', 'AM');
  assert.match(report.text, /SP1, PM1 @ 10:00 AM\nSP1 @ 10:00 AM/);
  assert.match(report.text, /SP1 @ 10:15 AM/);
  assert.match(report.text, /SP1 @ 10:00 AM\n\u2014 CANOY \u2014/);
  assert.match(report.text, /SP1 @ 10:00 AM \(Hold pending retest\)/);
  assert.match(report.text, /Unnamed sample @ 10:00 AM/);
  assert.doesNotMatch(report.text, /SECRET/i);
  assert.equal(report.count, 9);
});

test('ENVI control aliases and handovers preserve separate collections and unrecognized names', () => {
  const swab = (SAMPLE: string, control: string) => ({
    SAMPLE, 'DATE SWABBED': '11/10/2026', 'TIME SWABBED': '5:30 PM', 'ANALYZED BY': 'ROY',
    'CONTROL NUMBER': control,
  });
  const rows = { ENVI: [
    swab('SP1 Body', 'PRIVATE-1'),
    { ...swab('SP1 Stirrer', ''), 'control no.': 'PRIVATE-1' },
    { ...swab('SP1 Body', ''), 'CONTROL NO': 'PRIVATE-2' },
    { ...swab('Unrecognized machine - modified swabpoint', ''), CONTROL: 'PRIVATE-2' },
    swab('SP1 Body', ''),
  ] };
  for (const shift of ['AM', 'PM'] as const) {
    const report = generateShiftSummary(rows, '2026-11-10', shift);
    assert.equal(report.text.match(/ @ 5:30 PM/g)?.length, 3);
    assert.match(report.text, /SP1, Unrecognized machine - modified swabpoint @ 5:30 PM/);
    assert.doesNotMatch(report.text, /PRIVATE/);
    assert.deepEqual(report.warnings, []);
    assert.equal(report.count, 5);
  }
});

test('empty shifts are explicit and splitting preserves all content and Unicode', () => {
  const report = generateShiftSummary({}, '2026-10-28', 'AM');
  assert.equal(report.count, 0);
  assert.match(report.text, /No samples recorded/);
  const text = 'Sample \ud83e\uddea\n'.repeat(1000);
  const chunks = splitTelegramText(text);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.every(chunk => chunk.length <= 4000 && !/[\uD800-\uDBFF]$/.test(chunk)));
});

for (const shift of ['AM', 'PM'] as const) {
  test(`${shift} includes only unassigned overtime through preview time within the following shift`, () => {
    const cutoff = shift === 'AM' ? '2026-12-31T18:00:00' : '2027-01-01T06:00:00';
    const preview = shift === 'AM' ? '2027-01-01T00:30:00' : '2027-01-01T08:00:00';
    const nextShiftEnd = shift === 'AM' ? '2027-01-01T06:00:00' : '2027-01-01T18:00:00';
    const rows = Object.fromEntries(['ENVI', 'WATER', 'RawMats'].map(type => [type, [
      ['At cutoff', cutoff, '', ''],
      ['At preview', preview, ' - ', ' n/a '],
      ['Assigned analyst', cutoff, 'ROY', ''],
      ['Assigned performer', cutoff, '', 'DCN'],
      ['Future sample', `${preview.slice(0, 10)}T${shift === 'AM' ? '00:31' : '08:01'}:00`, '', ''],
      ['Following shift end', nextShiftEnd, '', ''],
      ['Later day', '2027-01-02T08:00:00', '', ''],
    ].map(([SAMPLE, time, analyst, performer]) => ({
      SAMPLE, 'WATER SOURCE': SAMPLE, DATE: time.slice(0, 10), TIME: time.slice(11),
      ' analyzed by ': analyst, ' performed by ': performer, 'RECEIVED BY': 'RECEIVER',
      REMARKS: 'Hold pending retest',
    }))]));
    const report = generateShiftSummary(rows, '2026-12-31', shift, new Date(`${preview}+08:00`));
    assert.equal(report.count, 6);
    const destination = shift === 'AM' ? 'Night Shift' : 'Dayshift';
    assert.match(report.text, new RegExp(`Endorse to ${destination}\\n\\nENVI`));
    assert.equal(report.text.match(/At cutoff @/g)?.length, 3);
    assert.equal(report.text.match(/At preview @/g)?.length, 3);
    assert.equal(report.text.match(/Hold pending retest/g)?.length, 6);
    assert.doesNotMatch(report.text, /Assigned|Future sample|Following shift end|Later day|Endorsed by/);
    assert.deepEqual(report.warnings, []);

    const historical = generateShiftSummary(rows, '2026-12-31', shift, new Date('2027-01-03T12:00:00+08:00'));
    assert.equal(historical.count, 9);
    assert.doesNotMatch(historical.text, /Following shift end|Later day|Assigned/);
    const beforeCutoff = generateShiftSummary(rows, '2026-12-31', shift,
      new Date(new Date(`${cutoff}+08:00`).getTime() - 1));
    assert.equal(beforeCutoff.count, 0);
  });
}
