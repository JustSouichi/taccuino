import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NOTES_DIR = path.join(__dirname, '..', 'notes');

function ensureNotesDir() {
  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
  }
}

function getNoteFilePath(noteId) {
  return path.join(NOTES_DIR, `${noteId}.json`);
}

export function createNote(title, content) {
  ensureNotesDir();
  const note = {
    id: uuidv4(),
    title: title || 'Untitled',
    content: content || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    externalFiles: []
  };
  fs.writeFileSync(getNoteFilePath(note.id), JSON.stringify(note, null, 2));
  return note;
}

export function getAllNotes() {
  ensureNotesDir();
  const files = fs.readdirSync(NOTES_DIR);
  const notes = [];
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const filePath = path.join(NOTES_DIR, file);
      notes.push(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    }
  });
  notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return notes;
}

export function getNoteById(noteId) {
  const filePath = getNoteFilePath(noteId);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

export function updateNote(noteId, updates) {
  const note = getNoteById(noteId);
  if (!note) {
    throw new Error('Note not found');
  }
  Object.assign(note, updates);
  note.updated_at = new Date().toISOString();
  fs.writeFileSync(getNoteFilePath(noteId), JSON.stringify(note, null, 2));
  return note;
}

export function deleteNote(noteId) {
  const filePath = getNoteFilePath(noteId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export function deleteAllNotes() {
  ensureNotesDir();
  const files = fs.readdirSync(NOTES_DIR);
  files.forEach(file => {
    if (file.endsWith('.json')) {
      fs.unlinkSync(path.join(NOTES_DIR, file));
    }
  });
}

export function searchNotes(query) {
  const allNotes = getAllNotes();
  return allNotes.filter(note =>
    note.title.toLowerCase().includes(query.toLowerCase()) ||
    note.content.toLowerCase().includes(query.toLowerCase())
  );
}
