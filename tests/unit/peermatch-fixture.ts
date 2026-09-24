/* SYNTHETIC — a made-up PeerMatch backup in PeerMatch's exact format (backup-v28 / v125).
   All names and numbers are invented (numbers contain 000). */
import { strToU8, zipSync } from 'fflate';

export const T = { s1: 1700000000001, s2: 1700000000002, g1: 1700000000101, g2: 1700000000102, b1: 1700000000201 };
const share = 1726000000000;
const match = 1726200000000;

export function peerMatchState() {
  return {
    shadchanim: [
      { id: T.s1, name: 'Rivka Example', phone: '050-000-0101', email: 'rivka@example.com', tags: 'Chabad, 35+, Israel',
        callReminderDate: '2026-09-25T00:00:00.000Z', waitingForReply: true, waitingForReplySince: '2026-09-20T10:00:00.000Z',
        activities: [
          { id: share * 1000 + 2, type: 'action', action: 'Profile received • WhatsApp', text: 'Chaya profile', shareLinkId: 'L1', sharedProfileId: T.g1, sharedProfileKind: 'girls', profileId: T.g1, ts: 'x' },
          { id: (share + 60000) * 1000 + 2, type: 'action', action: 'Profile received • WhatsApp', text: 'Chaya profile', shareLinkId: 'L2', sharedProfileId: T.g1, sharedProfileKind: 'girls', ts: 'x' },
          { id: 1726100000500, type: 'action', action: 'Profile received • WhatsApp', text: 'old share', mirroredFromProfileActivityId: 1726100000000, sharedProfileId: T.g1, sharedProfileKind: 'girls', ts: 'x' },
          { id: match + 3, type: 'action', action: 'Match sent • WhatsApp', text: 'Shidduch suggestion', matchId: match, guyId: T.b1, girlId: T.g1, shadchanId: T.s1, pmV60: true, ts: 'x' },
          { id: 1726300000000, type: 'wa-in', text: 'Thanks, I will look', ts: 'x' }
        ] },
      { id: T.s2, name: 'Moshe Example', phone: '+972 50 000 0102', referredById: T.s1, activities: [] }
    ],
    girls: [
      { id: T.g1, name: 'Chaya Example', age: '29', text: 'Chaya Example\nAge 29\nLooking for a kind guy', tags: 'BT',
        linkedShadchanId: T.s1, sourceName: 'Rivka Example', sourcePhone: '+972 50 000 0101', kohen: false, divorced: false,
        lookingFor: 'A kind, learning guy', lookingForMaxAge: '35',
        photo: { __peerMatchFile: 1, path: 'photos/000001_chaya.jpg', type: 'image/jpeg', name: 'chaya.jpg' },
        activities: [
          { id: share * 1000 + 1, type: 'action', action: 'Profile sent • WhatsApp', text: 'Chaya profile', shareLinkId: 'L1', recipientShadchanId: T.s1, sharedProfileId: T.g1, sharedProfileKind: 'girls', ts: 'x' },
          { id: (share + 60000) * 1000 + 1, type: 'action', action: 'Profile sent • WhatsApp', text: 'Chaya profile', shareLinkId: 'L2', recipientShadchanId: T.s1, sharedProfileId: T.g1, sharedProfileKind: 'girls', ts: 'x' },
          { id: 1726100000000, type: 'action', action: 'Profile shared • WhatsApp', text: 'old share', ts: 'x' },
          { id: match + 2, type: 'action', action: 'Match sent • WhatsApp', text: 'Shidduch suggestion', matchId: match, guyId: T.b1, girlId: T.g1, shadchanId: T.s1, pmV60: true, ts: 'x' }
        ] },
      { id: T.g2, name: 'Leah Example', age: '33', text: 'Leah Example', activities: [] }
    ],
    guys: [
      { id: T.b1, name: 'Dovid Example', age: '31', text: 'Dovid Example\nLearning and working', contact1Name: 'Friend Example', contact1Phone: '050-000-0202',
        profileAudio: { __peerMatchFile: 1, path: 'audio/000002_profile.webm', type: 'audio/webm', name: '' }, profileAudioText: 'He is a good guy',
        activities: [
          { id: match + 1, type: 'action', action: 'Match sent • WhatsApp', text: 'Shidduch suggestion', matchId: match, guyId: T.b1, girlId: T.g1, shadchanId: T.s1, pmV60: true, ts: 'x' },
          { id: 1726400000000, type: 'audio', audio: { __peerMatchFile: 1, path: 'audio/000003_note.webm', type: 'audio/webm', name: '' }, ts: 'x' },
          { id: 1726500000000, type: 'text', text: 'Spoke with his friend', ts: 'x' }
        ] }
    ]
  };
}

export function peerMatchZip(state = peerMatchState()): Uint8Array {
  const manifest = { format: 'PeerMatchBackup', version: 2, createdAt: '2026-09-24T00:00:00.000Z', database: 'PeerMatchDB', databaseVersion: 2,
    counts: { shadchanim: state.shadchanim.length, guys: state.guys.length, girls: state.girls.length },
    stores: { kv: [{ key: 'state', value: state }], inbox: [] } };
  return zipSync({
    'data.json': strToU8(JSON.stringify(manifest)),
    'photos/000001_chaya.jpg': new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    'audio/000002_profile.webm': new Uint8Array([1, 2, 3]),
    'audio/000003_note.webm': new Uint8Array([4, 5, 6])
  }, { level: 0 });
}

export function peerMatchTxt(zip = peerMatchZip()): string {
  let bin = '';
  for (const b of zip) bin += String.fromCharCode(b);
  return 'PEERMATCH-BACKUP-TEXT-V1\n' + btoa(bin);
}
