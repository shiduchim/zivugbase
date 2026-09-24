import Dexie, { type EntityTable } from 'dexie';
import type { Activity, Draft, FileRec, Idea, InboxItem, List, Person, Setting } from './types';

export class ZivugDB extends Dexie {
  people!: EntityTable<Person, 'id'>;
  ideas!: EntityTable<Idea, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  inbox!: EntityTable<InboxItem, 'id'>;
  files!: EntityTable<FileRec, 'id'>;
  lists!: EntityTable<List, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  drafts!: EntityTable<Draft, 'key'>;

  constructor(name = 'zivugbase') {
    super(name);
    this.version(1).stores({
      people: 'id, *roles, name, createdAt, updatedAt, deletedAt, *phoneKeys, legacyKey',
      ideas: 'id, aId, bId, status, updatedAt, deletedAt, legacyKey',
      activities: 'id, at, *linkKeys, deletedAt, legacyKey',
      inbox: 'id, receivedAt, level, queueRef',
      files: 'id, createdAt',
      lists: 'id, name',
      settings: 'key',
      drafts: 'key'
    });
  }
}

export let db = new ZivugDB();

/* Tests use a fresh database each time. */
export function useDatabase(name: string): ZivugDB {
  db = new ZivugDB(name);
  return db;
}

export const TABLES = ['people', 'ideas', 'activities', 'inbox', 'files', 'lists', 'settings', 'drafts'] as const;
