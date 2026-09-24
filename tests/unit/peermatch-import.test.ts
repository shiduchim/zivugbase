import { beforeEach, describe, expect, it } from 'vitest';
import { db, useDatabase } from '../../src/db/db';
import { ensureMe, timeline } from '../../src/db/repo';
import { applySuggestedToMe, importPeerMatch, looksLikePeerMatch, readPeerMatchFile } from '../../src/import/peermatch';
import { peerMatchTxt, peerMatchZip } from './peermatch-fixture';

let n = 0;
beforeEach(() => { useDatabase('test-import-' + n++); });

const byName = async (name: string) => (await db.people.toArray()).find((p) => p.name === name)!;

describe('PeerMatch import', () => {
  it('reads the zip and the emailed text wrapper the same way', async () => {
    const zip = peerMatchZip();
    expect(looksLikePeerMatch(zip)).toBe(true);
    const a = await readPeerMatchFile(new Blob([zip as BlobPart]));
    const b = await readPeerMatchFile(new Blob([peerMatchTxt(zip)]));
    expect(b.state).toEqual(a.state);
    expect(a.state.girls.length).toBe(2);
  });

  it('turns shadchanim, singles and contact people into one record each', async () => {
    const r = await importPeerMatch(await readPeerMatchFile(new Blob([peerMatchZip() as BlobPart])));
    expect(r.shadchanim).toBe(2);
    expect(r.singles).toBe(3);
    expect(r.contacts).toBe(1); /* the sender's number is a known shadchan → no duplicate person */
    const rivka = await byName('Rivka Example');
    const chaya = await byName('Chaya Example');
    expect(chaya.contactPeople).toEqual([{ personId: rivka.id, relation: 'Sent by' }]);
    expect(chaya.cameFrom).toEqual({ kind: 'referred', personId: rivka.id });
    expect((await byName('Moshe Example')).cameFrom?.personId).toBe(rivka.id);
    expect(rivka.tags).toEqual(['Chabad', '35+', 'Israel']);
    expect(rivka.nextStep?.what).toBe('Call');
    expect(rivka.waitingSince).toBe(Date.parse('2026-09-20T10:00:00.000Z'));
    expect(chaya.age).toEqual({ value: 29, asOf: 1700000000101, estimated: true });
    expect(chaya.lookingFor).toEqual({ text: 'A kind, learning guy', maxAge: 35 });
    expect(chaya.photoFileIds.length).toBe(1);
    expect(chaya.legacy?.collection).toBe('girls');
  });

  it('merges the copies PeerMatch stored of one event, and keeps real repeats apart', async () => {
    const r = await importPeerMatch(await readPeerMatchFile(new Blob([peerMatchZip() as BlobPart])));
    const rivka = await byName('Rivka Example');
    const chaya = await byName('Chaya Example');
    const dovid = await byName('Dovid Example');
    const shared = (await timeline(chaya.id)).filter((a) => a.kind === 'profile-sent');
    expect(shared.length).toBe(3); /* L1 and L2 are two real sends; the old mirrored pair is one */
    for (const a of shared) expect(a.linkKeys.sort()).toEqual(['p:' + chaya.id, 'p:' + rivka.id].sort());
    const matchEntries = (await timeline(dovid.id)).filter((a) => a.title?.startsWith('Match sent'));
    expect(matchEntries.length).toBe(1);
    expect(matchEntries[0]!.linkKeys.length).toBe(3);
    expect(r.mergedCopies).toBe(2 + 2 + 1); /* L1 pair, L2 pair → 1 each; match 3 → 1; mirror pair → 1 */
    expect(r.ideas).toBe(1);
    const idea = (await db.ideas.toArray())[0]!;
    expect([idea.aId, idea.bId]).toEqual([dovid.id, chaya.id]);
  });

  it('keeps audio, and real dates from PeerMatch ids', async () => {
    await importPeerMatch(await readPeerMatchFile(new Blob([peerMatchZip() as BlobPart])));
    const dovid = await byName('Dovid Example');
    const acts = await timeline(dovid.id);
    const audio = acts.find((a) => a.kind === 'audio')!;
    expect(audio.at).toBe(1726400000000);
    expect(await db.files.get(audio.audioFileId!)).toBeTruthy();
    expect(dovid.audioProfile?.transcript).toBe('He is a good guy');
    expect((await db.files.get(dovid.audioProfile!.fileId))?.size).toBe(3);
  });

  it('can be run again without duplicating anything', async () => {
    const file = new Blob([peerMatchZip() as BlobPart]);
    await importPeerMatch(await readPeerMatchFile(file));
    const counts = [await db.people.count(), await db.activities.count(), await db.ideas.count(), await db.files.count()];
    const again = await importPeerMatch(await readPeerMatchFile(file));
    expect(again.singles + again.shadchanim + again.activities).toBe(0);
    expect(again.alreadyThere).toBe(5);
    expect([await db.people.count(), await db.activities.count(), await db.ideas.count(), await db.files.count()]).toEqual(counts);
  });

  it('asks about girls suggested to me, pre-ticking the likely ones, and records Ideas', async () => {
    const r = await importPeerMatch(await readPeerMatchFile(new Blob([peerMatchZip() as BlobPart])));
    expect(r.review.map((x) => [x.name, x.preTicked])).toEqual([['Chaya Example', true], ['Leah Example', false]]);
    const me = await ensureMe();
    expect(await applySuggestedToMe(me.id, r.review.map((x) => ({ personId: x.personId, yes: x.preTicked })))).toBe(1);
    expect((await byName('Chaya Example')).suggestedToMe).toBe(true);
    expect((await db.ideas.where('aId').equals(me.id).toArray()).length).toBe(1);
    await applySuggestedToMe(me.id, [{ personId: r.review[0]!.personId, yes: false }]);
    expect((await db.ideas.where('aId').equals(me.id).toArray()).length).toBe(0);
  });
});
