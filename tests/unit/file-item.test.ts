/* SYNTHETIC — made-up text only. */
import { beforeEach, describe, expect, it } from 'vitest';
import { useDatabase } from '../../src/db/db';
import { blankPerson, savePerson, getMe } from '../../src/db/repo';
import { addToInbox } from '../../src/inbox/inbox';
import { fileItem, guessFromText, possibleSame, answerIdea } from '../../src/inbox/fileItem';
import { db } from '../../src/db/db';

let n = 0;
beforeEach(() => { useDatabase('file-item-' + ++n); });

describe('guessFromText', () => {
  it('reads name, age, city and phone', () => {
    const g = guessFromText('Shira Example, age 27, lives in Jerusalem.\nCall her mother 050-000-0303');
    expect(g).toMatchObject({ name: 'Shira Example', age: '27', city: 'Jerusalem', phones: ['050-000-0303'] });
  });
  it('drops WhatsApp copy prefixes and recognizes a known sender', () => {
    const s = blankPerson({ roles: ['shadchan'], name: 'Rivka Example' });
    const g = guessFromText('[25/09/2026, 10:00] Rivka Example: Miriam Example\n[25/09/2026, 10:01] Rivka Example: 28 years old', [s]);
    expect(g.name).toBe('Miriam Example');
    expect(g.age).toBe('28');
    expect(g.senderId).toBe(s.id);
  });
  it('does not take a greeting or a long sentence as a name', () => {
    expect(guessFromText('Hi, I have an idea for you').name).toBe('');
    expect(guessFromText('There is a very nice girl I know from the seminary').name).toBe('');
  });
  it('never guesses a sender that is not already known', () => {
    expect(guessFromText('[25/09/2026, 10:00] Someone New: hello', []).senderId).toBeUndefined();
  });
});

describe('fileItem', () => {
  it('an idea for me: the girl, the idea, the timeline entry linked to the shadchan, the item filed', async () => {
    const shad = await savePerson(blankPerson({ roles: ['shadchan'], name: 'Rivka Example' }));
    const item = await addToInbox('paste', 'Miriam Example\nage 28');
    const p = await fileItem(item, { kind: 'idea', name: 'Miriam Example', age: '28', gender: 'f', city: 'Bnei Brak', phones: ['050-000-0404'], senderId: shad.id });
    expect(p.suggestedToMe).toBe(true);
    expect(p.cameFrom).toMatchObject({ kind: 'referred', personId: shad.id });
    expect(p.profile.text).toBe('Miriam Example\nage 28');
    expect(p.age?.value).toBe(28);
    const me = await getMe();
    const ideas = await db.ideas.toArray();
    expect(ideas).toHaveLength(1);
    expect(ideas[0]).toMatchObject({ aId: me!.id, bId: p.id, status: 'new' });
    const acts = await db.activities.toArray();
    expect(acts[0]!.linkKeys.sort()).toEqual(['p:' + p.id, 'p:' + shad.id].sort());
    expect((await db.inbox.get(item.id))!.level).toBe('filed');
    const undo = await answerIdea(ideas[0]!.id, 'no');
    expect((await db.ideas.get(ideas[0]!.id))!.status).toBe('no');
    await undo();
    expect((await db.ideas.get(ideas[0]!.id))!.status).toBe('new');
  });
  it('flags the same phone or name', async () => {
    await savePerson(blankPerson({ roles: ['single'], name: 'Miriam Example', phones: [{ number: '050-000-0404', type: 'mobile' }] }));
    expect(await possibleSame('Someone', ['+972 50 000 0404'])).toHaveLength(1);
    expect(await possibleSame('miriam example', [])).toHaveLength(1);
    expect(await possibleSame('Other Name', [])).toHaveLength(0);
  });
});
