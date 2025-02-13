#!/usr/bin/env node
import { program } from 'commander';
import blessed from 'blessed';
import figlet from 'figlet';
import os from 'os';
import fs from 'fs';
import path from 'path';

/******************************************************************************
 * 1) DETECT OS AND SET NOTES FOLDER OUTSIDE THE NPM PACKAGE
 ******************************************************************************/

function getNotesDir() {
  const platform = os.platform();
  let baseDir;

  if (platform === 'win32') {
    // On Windows, store in %APPDATA%\Taccuino\notes
    baseDir = process.env.APPDATA || os.homedir();
    return path.join(baseDir, 'Taccuino', 'notes');
  } else if (platform === 'darwin') {
    // On macOS, store in ~/Library/Application Support/Taccuino/notes
    return path.join(os.homedir(), 'Library', 'Application Support', 'Taccuino', 'notes');
  } else {
    // On Linux or other, store in ~/.taccuino/notes
    return path.join(os.homedir(), '.taccuino', 'notes');
  }
}

// Ensure the folder exists
const NOTES_DIR = getNotesDir();
if (!fs.existsSync(NOTES_DIR)) {
  fs.mkdirSync(NOTES_DIR, { recursive: true });
}

/******************************************************************************
 * 2) NOTE LOGIC (CREATE, READ, UPDATE, DELETE, SEARCH)
 *    STORED AS JSON FILES IN NOTES_DIR
 ******************************************************************************/

function getNoteFilePath(noteId) {
  return path.join(NOTES_DIR, `${noteId}.json`);
}

// Generate a unique ID. For simplicity, we can do a timestamp + random approach.
function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * CREATE NOTE
 */
function createNote(title, content) {
  const id = generateId();
  const note = {
    id,
    title,
    content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  fs.writeFileSync(getNoteFilePath(id), JSON.stringify(note, null, 2), 'utf8');
}

/**
 * GET ALL NOTES
 */
function getAllNotes() {
  const files = fs.readdirSync(NOTES_DIR);
  const notes = [];
  files.forEach(file => {
    if (file.endsWith('.json')) {
      const data = fs.readFileSync(path.join(NOTES_DIR, file), 'utf8');
      const note = JSON.parse(data);
      notes.push(note);
    }
  });
  // Sort by created_at descending
  notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return notes;
}

/**
 * UPDATE NOTE
 */
function updateNote(noteId, { title, content }) {
  const filePath = getNoteFilePath(noteId);
  if (!fs.existsSync(filePath)) {
    throw new Error('Note does not exist');
  }
  const note = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  note.title = title;
  note.content = content;
  note.updated_at = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(note, null, 2), 'utf8');
}

/**
 * DELETE NOTE
 */
function deleteNote(noteId) {
  const filePath = getNoteFilePath(noteId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  } else {
    throw new Error('Note not found');
  }
}

/**
 * SEARCH NOTES
 */
function searchNotes(query) {
  const all = getAllNotes();
  const lower = query.toLowerCase();
  return all.filter(n =>
    n.title.toLowerCase().includes(lower) ||
    n.content.toLowerCase().includes(lower)
  );
}

/******************************************************************************
 * 3) THEME & LAYOUT CONSTANTS
 ******************************************************************************/

const theme = {
  background: 'black',
  foreground: 'white',
  bannerFg: 'brightmagenta',
  borderFg: 'magenta',
  primaryBg: 'blue',
  primaryFg: 'white',
  secondaryBg: 'red',
  secondaryFg: 'white',
  highlightBg: 'brightgreen',
  highlightFg: 'black',
  instructionFg: 'black',
  instructionBg: 'brightyellow',
  errorBg: 'brightred',
  errorFg: 'white'
};

const BANNER_HEIGHT = 9;
const BOTTOM_BAR_HEIGHT = 3;

/******************************************************************************
 * 4) COMMANDER CLI CONFIG
 ******************************************************************************/

program
  .version('1.0.0')
  .description('Taccuino - CLI Note Manager');

program
  .command('open')
  .description('Open the Taccuino full-screen interface')
  .action(() => {
    openUI();
  });

// NUOVI COMANDI
program
  .command('export <file>')
  .description('Export all notes to a JSON file')
  .action((file) => {
    exportNotes(file);
  });

program
  .command('import <file>')
  .description('Import notes from a JSON file')
  .action((file) => {
    importNotes(file);
  });

program.parse(process.argv);



/******************************************************************************
 * 5) BLESSED UI CODE
 ******************************************************************************/

/**
 * MAIN UI ENTRY
 */
function openUI() {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Taccuino'
  });

  // Root container
  const layout = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    style: { fg: theme.foreground, bg: theme.background }
  });

  // Banner
  const asciiText = figlet.textSync('Taccuino', { font: 'Shadow' });
  const banner = blessed.box({
    parent: layout,
    top: 0,
    left: 'center',
    width: '100%',
    height: BANNER_HEIGHT,
    content: asciiText,
    align: 'center',
    style: {
      fg: theme.bannerFg,
      bg: theme.background,
      bold: true
    }
  });

  // Instruction bar
  const instructionBar = blessed.box({
    parent: layout,
    bottom: 0,
    left: 0,
    width: '100%',
    height: BOTTOM_BAR_HEIGHT,
    border: { type: 'line', fg: theme.borderFg },
    style: {
      fg: theme.instructionFg,
      bg: theme.instructionBg
    },
    align: 'center',
    content: 'Enter: Open | n: New | s: Search | d: Delete | q: Quit'
  });

  // Main area
  const mainArea = blessed.box({
    parent: layout,
    top: BANNER_HEIGHT,
    left: 0,
    width: '100%',
    height: `100%-${BANNER_HEIGHT + BOTTOM_BAR_HEIGHT}`,
    style: { fg: theme.foreground, bg: theme.background }
  });

  showNoteList(screen, mainArea);

  screen.key(['C-c'], () => process.exit(0));

  screen.on('resize', () => {
    banner.width = '100%';
    mainArea.width = '100%';
    mainArea.height = `100%-${BANNER_HEIGHT + BOTTOM_BAR_HEIGHT}`;
    instructionBar.width = '100%';
    screen.render();
  });

  screen.render();
}

/**
 * SHOW NOTE LIST
 */
function showNoteList(screen, mainArea) {
  mainArea.children.forEach(child => child.detach());

  const noteList = blessed.list({
    parent: mainArea,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    keys: true,
    vi: true,
    mouse: true,
    border: { type: 'line', fg: theme.borderFg },
    style: {
      fg: theme.foreground,
      bg: theme.background,
      selected: {
        bg: 'brightmagenta',
        fg: 'white'
      }
    },
    items: []
  });

  let all = [];
  try {
    all = getAllNotes();
  } catch (error) {
    return showError(screen, `Error reading notes: ${error.message}`, () => {
      all = [];
    });
  }

  noteList.notes = all;
  const items = all.map((note, index) => {
    return `${index + 1}. ${note.title} (${note.created_at.slice(0, 10)}) [🗑]`;
  });
  noteList.setItems(items);

  noteList.focus();
  screen.render();

  // Key bindings
  screen.key(['q'], () => process.exit(0));
  screen.key(['n'], () => showCreateNoteForm(screen, mainArea));
  screen.key(['s'], () => showSearchPrompt(screen, mainArea));
  screen.key(['d'], () => {
    const selIndex = noteList.selected;
    if (noteList.notes && noteList.notes[selIndex]) {
      const note = noteList.notes[selIndex];
      confirmDeleteNoteUI(screen, mainArea, note.id);
    }
  });

  noteList.on('select', (item, index) => {
    if (noteList.notes && noteList.notes[index]) {
      showNoteView(screen, mainArea, noteList.notes[index]);
    }
  });
}

/**
 * SHOW NOTE VIEW
 */
function showNoteView(screen, mainArea, note) {
  mainArea.children.forEach(child => child.detach());

  const box = blessed.box({
    parent: mainArea,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    scrollable: true,
    alwaysScroll: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background },
    content: `Title: ${note.title}\n\nContent:\n${note.content}\n\nPress Esc or q to go back\nPress e to edit this note`
  });

  box.focus();
  screen.render();

  box.key(['escape', 'q'], () => {
    showNoteList(screen, mainArea);
  });

  box.key(['e'], () => {
    showEditNoteForm(screen, mainArea, note);
  });
}

/**
 * CREATE NOTE FORM
 */
function showCreateNoteForm(screen, mainArea) {
  mainArea.children.forEach(child => child.detach());

  const form = blessed.form({
    parent: mainArea,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    keys: true,
    mouse: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background },
    label: ' New Note '
  });

  blessed.text({
    parent: form,
    top: 1,
    left: 2,
    content: 'Title:',
    style: { fg: theme.foreground, bg: theme.background }
  });

  const titleInput = blessed.textbox({
    parent: form,
    name: 'title',
    top: 2,
    left: 2,
    width: '95%',
    height: 3,
    keys: true,
    mouse: true,
    inputOnFocus: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background }
  });

  blessed.text({
    parent: form,
    top: 6,
    left: 2,
    content: 'Content:',
    style: { fg: theme.foreground, bg: theme.background }
  });

  const contentInput = blessed.textarea({
    parent: form,
    name: 'content',
    top: 7,
    left: 2,
    width: '95%',
    height: '40%',
    keys: true,
    mouse: true,
    inputOnFocus: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background },
    scrollable: true,
    alwaysScroll: true
  });

  const submitButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    bottom: 2,
    left: '35%',
    name: 'submit',
    content: 'Submit',
    style: {
      fg: theme.primaryFg,
      bg: theme.primaryBg,
      focus: { bg: theme.highlightBg, fg: theme.highlightFg },
      hover: { bg: theme.highlightBg, fg: theme.highlightFg }
    }
  });

  const cancelButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    bottom: 2,
    left: '50%',
    name: 'cancel',
    content: 'Cancel',
    style: {
      fg: theme.secondaryFg,
      bg: theme.secondaryBg,
      focus: { bg: theme.highlightBg, fg: theme.highlightFg },
      hover: { bg: theme.highlightBg, fg: theme.highlightFg }
    }
  });

  submitButton.key(['left', 'right'], () => cancelButton.focus());
  cancelButton.key(['left', 'right'], () => submitButton.focus());

  submitButton.on('press', () => form.submit());
  cancelButton.on('press', () => {
    showNoteList(screen, mainArea);
  });

  form.on('submit', data => {
    const title = data.title?.trim();
    const content = data.content?.trim();
    if (!title) {
      showMessage(screen, 'Title is required!', () => {
        titleInput.focus();
      });
    } else {
      try {
        createNote(title, content);
        showMessage(screen, 'Note created successfully!', () => {
          showNoteList(screen, mainArea);
        });
      } catch (error) {
        showError(screen, `Error creating note: ${error.message}`, () => {
          showNoteList(screen, mainArea);
        });
      }
    }
  });

  screen.key(['escape', 'q'], () => {
    showNoteList(screen, mainArea);
  });

  screen.render();
  titleInput.focus();
}

/**
 * EDIT NOTE FORM
 */
function showEditNoteForm(screen, mainArea, note) {
  mainArea.children.forEach(child => child.detach());

  const form = blessed.form({
    parent: mainArea,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    keys: true,
    mouse: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background },
    label: ' Edit Note '
  });

  blessed.text({
    parent: form,
    top: 1,
    left: 2,
    content: 'Title:',
    style: { fg: theme.foreground, bg: theme.background }
  });

  const titleInput = blessed.textbox({
    parent: form,
    name: 'title',
    top: 2,
    left: 2,
    width: '95%',
    height: 3,
    keys: true,
    mouse: true,
    inputOnFocus: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background }
  });
  titleInput.setValue(note.title);

  blessed.text({
    parent: form,
    top: 6,
    left: 2,
    content: 'Content:',
    style: { fg: theme.foreground, bg: theme.background }
  });

  const contentInput = blessed.textarea({
    parent: form,
    name: 'content',
    top: 7,
    left: 2,
    width: '95%',
    height: '40%',
    keys: true,
    mouse: true,
    inputOnFocus: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background },
    scrollable: true,
    alwaysScroll: true
  });
  contentInput.setValue(note.content);

  const saveButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    bottom: 2,
    left: '35%',
    name: 'save',
    content: 'Save',
    style: {
      fg: theme.primaryFg,
      bg: theme.primaryBg,
      focus: { bg: theme.highlightBg, fg: theme.highlightFg },
      hover: { bg: theme.highlightBg, fg: theme.highlightFg }
    }
  });

  const cancelButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    bottom: 2,
    left: '50%',
    name: 'cancel',
    content: 'Cancel',
    style: {
      fg: theme.secondaryFg,
      bg: theme.secondaryBg,
      focus: { bg: theme.highlightBg, fg: theme.highlightFg },
      hover: { bg: theme.highlightBg, fg: theme.highlightFg }
    }
  });

  saveButton.key(['left', 'right'], () => cancelButton.focus());
  cancelButton.key(['left', 'right'], () => saveButton.focus());

  saveButton.on('press', () => form.submit());
  cancelButton.on('press', () => {
    showNoteList(screen, mainArea);
  });

  form.on('submit', data => {
    const updatedTitle = data.title?.trim();
    const updatedContent = data.content?.trim();
    if (!updatedTitle) {
      showMessage(screen, 'Title is required!', () => {
        titleInput.focus();
      });
    } else {
      try {
        updateNote(note.id, { title: updatedTitle, content: updatedContent });
        showMessage(screen, 'Note updated successfully!', () => {
          showNoteList(screen, mainArea);
        });
      } catch (error) {
        showError(screen, `Error updating note: ${error.message}`, () => {
          showNoteList(screen, mainArea);
        });
      }
    }
  });

  screen.key(['escape', 'q'], () => {
    showNoteList(screen, mainArea);
  });

  screen.render();
  titleInput.focus();
}

/**
 * CONFIRM DELETE NOTE UI
 */
function confirmDeleteNoteUI(screen, mainArea, noteId) {
  mainArea.children.forEach(child => child.detach());

  const form = blessed.form({
    parent: mainArea,
    top: 'center',
    left: 'center',
    width: '60%',
    height: 'shrink',
    keys: true,
    mouse: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background },
    label: ' Confirm Deletion '
  });

  blessed.text({
    parent: form,
    top: 1,
    left: 1,
    content: 'Type YES to delete the note:',
    style: { fg: theme.foreground, bg: theme.background }
  });

  const input = blessed.textbox({
    parent: form,
    name: 'confirm',
    top: 3,
    left: 1,
    width: '90%',
    height: 3,
    keys: true,
    mouse: true,
    inputOnFocus: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background }
  });
  input.focus();

  const okayButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    top: 7,
    left: '25%',
    name: 'okay',
    content: 'Okay',
    style: {
      fg: theme.primaryFg,
      bg: theme.primaryBg,
      focus: { bg: theme.highlightBg, fg: theme.highlightFg },
      hover: { bg: theme.highlightBg, fg: theme.highlightFg }
    }
  });

  const cancelButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    top: 7,
    left: '50%',
    name: 'cancel',
    content: 'Cancel',
    style: {
      fg: theme.secondaryFg,
      bg: theme.secondaryBg,
      focus: { bg: theme.highlightBg, fg: theme.highlightFg },
      hover: { bg: theme.highlightBg, fg: theme.highlightFg }
    }
  });

  okayButton.key(['left', 'right'], () => cancelButton.focus());
  cancelButton.key(['left', 'right'], () => okayButton.focus());

  okayButton.on('press', () => form.submit());
  cancelButton.on('press', () => {
    showNoteList(screen, mainArea);
  });

  form.on('submit', data => {
    if ((data.confirm || '').trim() === 'YES') {
      try {
        deleteNote(noteId);
        showMessage(screen, 'Note deleted.', () => {
          showNoteList(screen, mainArea);
        });
      } catch (error) {
        showError(screen, `Error deleting note: ${error.message}`, () => {
          showNoteList(screen, mainArea);
        });
      }
    } else {
      showNoteList(screen, mainArea);
    }
  });

  screen.key(['escape', 'q'], () => {
    showNoteList(screen, mainArea);
  });

  screen.render();
}

/**
 * SEARCH PROMPT (FORM-BASED)
 */
function showSearchPrompt(screen, mainArea) {
  mainArea.children.forEach(child => child.detach());

  const form = blessed.form({
    parent: mainArea,
    top: 'center',
    left: 'center',
    width: '60%',
    height: 'shrink',
    keys: true,
    mouse: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background },
    label: ' Search Notes '
  });

  blessed.text({
    parent: form,
    top: 1,
    left: 1,
    content: 'Enter search query:',
    style: { fg: theme.foreground, bg: theme.background }
  });

  const input = blessed.textbox({
    parent: form,
    name: 'query',
    top: 3,
    left: 1,
    width: '90%',
    height: 3,
    keys: true,
    mouse: true,
    inputOnFocus: true,
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background }
  });
  input.focus();

  const okayButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    top: 7,
    left: '25%',
    name: 'okay',
    content: 'Okay',
    style: {
      fg: theme.primaryFg,
      bg: theme.primaryBg,
      focus: { bg: theme.highlightBg, fg: theme.highlightFg },
      hover: { bg: theme.highlightBg, fg: theme.highlightFg }
    }
  });

  const cancelButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    top: 7,
    left: '50%',
    name: 'cancel',
    content: 'Cancel',
    style: {
      fg: theme.secondaryFg,
      bg: theme.secondaryBg,
      focus: { bg: theme.highlightBg, fg: theme.highlightFg },
      hover: { bg: theme.highlightBg, fg: theme.highlightFg }
    }
  });

  okayButton.key(['left', 'right'], () => cancelButton.focus());
  cancelButton.key(['left', 'right'], () => okayButton.focus());

  okayButton.on('press', () => form.submit());
  cancelButton.on('press', () => {
    showNoteList(screen, mainArea);
  });

  form.on('submit', data => {
    const query = (data.query || '').trim();
    if (!query) {
      showNoteList(screen, mainArea);
      return;
    }
    let results = [];
    try {
      results = searchNotes(query);
    } catch (error) {
      return showError(screen, `Error searching notes: ${error.message}`, () => {
        showNoteList(screen, mainArea);
      });
    }
    if (!results || results.length === 0) {
      showMessage(screen, 'No matching notes found.', () => {
        showNoteList(screen, mainArea);
      });
    } else {
      showSearchResults(screen, mainArea, results);
    }
  });

  screen.key(['escape', 'q'], () => {
    showNoteList(screen, mainArea);
  });

  screen.render();
}

/**
 * SHOW SEARCH RESULTS
 */
function showSearchResults(screen, mainArea, results) {
  mainArea.children.forEach(child => child.detach());

  const resultsList = blessed.list({
    parent: mainArea,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    keys: true,
    vi: true,
    mouse: true,
    border: { type: 'line', fg: theme.borderFg },
    style: {
      fg: theme.foreground,
      bg: theme.background,
      selected: {
        bg: 'brightmagenta',
        fg: 'white'
      }
    },
    items: []
  });

  resultsList.notes = results;
  const items = results.map((note, index) => {
    return `${index + 1}. ${note.title} (${note.created_at.slice(0, 10)})`;
  });
  resultsList.setItems(items);

  resultsList.focus();
  screen.render();

  // Press d to delete
  screen.key(['d'], () => {
    const selIndex = resultsList.selected;
    if (resultsList.notes && resultsList.notes[selIndex]) {
      const note = resultsList.notes[selIndex];
      confirmDeleteNoteUI(screen, mainArea, note.id);
    }
  });

  // Press Enter to open
  resultsList.on('select', (item, index) => {
    if (resultsList.notes && resultsList.notes[index]) {
      showNoteView(screen, mainArea, resultsList.notes[index]);
    }
  });

  // Press q/Esc to go back
  screen.key(['q', 'escape'], () => {
    showNoteList(screen, mainArea);
  });
}

/******************************************************************************
 * 6) HELPER FUNCTIONS: showMessage, showError
 ******************************************************************************/

function showMessage(screen, text, callback) {
  const msg = blessed.message({
    parent: screen,
    border: { type: 'line', fg: theme.borderFg },
    width: '50%',
    height: 'shrink',
    top: 'center',
    left: 'center',
    style: { fg: theme.foreground, bg: theme.background },
    label: ' Info ',
    keys: true,
    mouse: true
  });
  msg.display(text, 2, callback);
}

function showError(screen, errorText, callback) {
  const msg = blessed.message({
    parent: screen,
    border: { type: 'line', fg: theme.borderFg },
    width: '60%',
    height: 'shrink',
    top: 'center',
    left: 'center',
    style: { fg: theme.errorFg, bg: theme.errorBg },
    label: ' Error ',
    keys: true,
    mouse: true
  });
  msg.display(errorText, 3, callback);
}

/**
 * EXPORT NOTES
 * Scrive tutte le note in un array JSON dentro <filePath>.
 */
function exportNotes(filePath) {
    try {
      const all = getAllNotes(); // Funzione che già hai definito
      const data = JSON.stringify(all, null, 2);
      fs.writeFileSync(filePath, data, 'utf8');
      console.log(`Export completed. Notes saved to: ${filePath}`);
    } catch (error) {
      console.error('Error exporting notes:', error.message);
    }
  }
  
  /**
   * IMPORT NOTES
   * Legge un array di note da <filePath> e le crea/aggiorna in Taccuino.
   */
  function importNotes(filePath) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const importedNotes = JSON.parse(raw);
  
      if (!Array.isArray(importedNotes)) {
        throw new Error('Invalid file format: JSON array expected');
      }
  
      // Per ogni nota importata, controlliamo se esiste già (stesso ID).
      // Se esiste, aggiorniamo, altrimenti creiamo.
      let countCreated = 0;
      let countUpdated = 0;
  
      importedNotes.forEach(noteData => {
        // Deve avere un id, un title e un content
        if (!noteData.id || !noteData.title || !noteData.content) {
          console.warn(`Skipping invalid note: ${JSON.stringify(noteData)}`);
          return;
        }
  
        const filePath = getNoteFilePath(noteData.id);
        if (fs.existsSync(filePath)) {
          // Aggiorna la nota esistente
          const existingNote = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          existingNote.title = noteData.title;
          existingNote.content = noteData.content;
          existingNote.created_at = noteData.created_at || existingNote.created_at;
          existingNote.updated_at = new Date().toISOString();
          fs.writeFileSync(filePath, JSON.stringify(existingNote, null, 2), 'utf8');
          countUpdated++;
        } else {
          // Crea una nuova nota con l'ID fornito
          const newNote = {
            id: noteData.id,
            title: noteData.title,
            content: noteData.content,
            created_at: noteData.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          fs.writeFileSync(filePath, JSON.stringify(newNote, null, 2), 'utf8');
          countCreated++;
        }
      });
  
      console.log(`Import completed. Created: ${countCreated}, Updated: ${countUpdated}`);
    } catch (error) {
      console.error('Error importing notes:', error.message);
    }
  }
  