#!/usr/bin/env node
import { program } from 'commander';
import blessed from 'blessed';
import * as notes from './src/notes.js';

program
  .version('1.0.0')
  .description('Taccuino - CLI Note Manager');

program
  .command('open')
  .description('Open the full-screen note manager (Vim-like)')
  .action(() => {
    const screen = blessed.screen({
      smartCSR: true,
      title: 'Taccuino'
    });
    fullScreenListUI(screen);

    // Allow exit with Ctrl-C
    screen.key(['C-c'], () => process.exit(0));
  });

program.parse(process.argv);

/**
 * Shows the main full-screen UI with the list of notes.
 */
function fullScreenListUI(screen) {
  screen.children.forEach(child => child.detach());

  const noteList = blessed.list({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '90%',
    height: '80%',
    keys: true,
    vi: true,
    mouse: true,
    border: { type: 'line' },
    style: {
      selected: { bg: 'blue' }
    },
    items: []
  });

  blessed.box({
    parent: screen,
    bottom: 0,
    left: 'center',
    width: '90%',
    height: 3,
    content: "Enter: Open note | n: New note | i: Import file | d: Delete note | q: Quit",
    border: { type: 'line' },
    align: 'center'
  });

  refreshNoteList(noteList, screen);

  noteList.focus();
  screen.render();

  // Global keys
  screen.key(['q'], () => process.exit(0));

  // Create a new note
  screen.key(['n'], () => {
    createNoteUI(screen);
  });

  // Import file (placeholder)
  screen.key(['i'], () => {
    const msg = blessed.message({
      parent: screen,
      border: 'line',
      width: '50%',
      height: 'shrink',
      top: 'center',
      left: 'center',
      label: ' Info '
    });
    msg.display('File import not implemented', 3, () => {
      noteList.focus();
    });
  });

  // Delete the selected note
  screen.key(['d'], () => {
    const selectedIndex = noteList.selected;
    if (noteList.notes && noteList.notes[selectedIndex]) {
      const note = noteList.notes[selectedIndex];
      confirmDeleteNote(screen, note.id);
    }
  });

  // Press Enter on a note to open it
  noteList.on('select', (item, index) => {
    if (noteList.notes && noteList.notes[index]) {
      openNoteUI(screen, noteList.notes[index]);
    }
  });
}

/**
 * Reloads the note list into the noteList widget.
 */
function refreshNoteList(noteList, screen) {
  const allNotes = notes.getAllNotes();
  noteList.notes = allNotes;

  const items = allNotes.map((note, index) => {
    return `${index + 1}. ${note.title} (${note.created_at.slice(0, 10)}) [🗑]`;
  });

  noteList.setItems(items);
  screen.render();
}

/**
 * Opens a note in read-only mode. Press 'e' to edit.
 */
function openNoteUI(screen, note) {
  screen.children.forEach(child => child.detach());

  const box = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '90%',
    height: '80%',
    content: `Title: ${note.title}\n\nContent:\n${note.content}\n\nPress Esc or q to go back\nPress e to edit this note`,
    scrollable: true,
    keys: true,
    vi: true,
    mouse: true,
    border: { type: 'line' },
    alwaysScroll: true,
    scrollbar: { ch: ' ', inverse: true }
  });

  box.focus();
  screen.render();

  box.key(['escape', 'q'], () => {
    fullScreenListUI(screen);
  });

  box.key(['e'], () => {
    editNoteUI(screen, note);
  });
}

/**
 * Displays a form to create a new note, with arrow-key focus switching between buttons.
 */
function createNoteUI(screen) {
  screen.children.forEach(child => child.detach());

  const form = blessed.form({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '70%',
    height: '70%',
    keys: true,
    vi: true,
    mouse: true,
    border: { type: 'line', fg: 'white' },
    style: { bg: 'black' },
    label: ' New Note '
  });

  // Instructions box (top-right)
  blessed.box({
    parent: form,
    top: 0,
    right: 1,
    width: 'shrink',
    height: 'shrink',
    content: "Tab: switch fields\nEnter in Content: newline\nEsc/q: cancel",
    style: { fg: 'gray' }
  });

  blessed.text({
    parent: form,
    top: 1,
    left: 2,
    content: 'Title:',
    style: { fg: 'white' }
  });

  const titleInput = blessed.textbox({
    parent: form,
    name: 'title',
    top: 2,
    left: 2,
    width: '95%',
    height: 3,
    keys: true,
    vi: true,
    mouse: true,
    inputOnFocus: true,
    border: { type: 'line', fg: 'white' }
  });

  blessed.text({
    parent: form,
    top: 6,
    left: 2,
    content: 'Content:',
    style: { fg: 'white' }
  });

  // Reduced height to prevent overlap with buttons
  const contentInput = blessed.textarea({
    parent: form,
    name: 'content',
    top: 7,
    left: 2,
    width: '95%',
    height: '40%',
    keys: true,
    vi: true,
    mouse: true,
    inputOnFocus: true,
    border: { type: 'line', fg: 'white' },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      inverse: true
    }
  });

  const submitButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    vi: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    bottom: 2,
    left: '35%',
    name: 'submit',
    content: 'Submit',
    style: {
      fg: 'white',
      bg: 'blue',
      focus: { bg: 'green' },
      hover: { bg: 'green' }
    }
  });

  const cancelButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    vi: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    bottom: 2,
    left: '50%',
    name: 'cancel',
    content: 'Cancel',
    style: {
      fg: 'white',
      bg: 'red',
      focus: { bg: 'yellow' },
      hover: { bg: 'yellow' }
    }
  });

  // Allow left/right arrow to switch focus between Submit and Cancel
  submitButton.key(['left', 'right'], () => {
    cancelButton.focus();
  });
  cancelButton.key(['left', 'right'], () => {
    submitButton.focus();
  });

  submitButton.on('press', () => form.submit());
  cancelButton.on('press', () => fullScreenListUI(screen));

  form.on('submit', data => {
    const title = data.title?.trim();
    const content = data.content?.trim();
    if (!title) {
      showMessage(screen, 'Title is required!', () => titleInput.focus());
    } else {
      notes.createNote(title, content);
      showMessage(screen, 'Note created successfully!', () => {
        fullScreenListUI(screen);
      });
    }
  });

  screen.key(['escape', 'q'], () => {
    fullScreenListUI(screen);
  });

  screen.render();
  titleInput.focus();
}

/**
 * Similar form for editing an existing note, also with arrow-key focus switching.
 */
function editNoteUI(screen, note) {
  screen.children.forEach(child => child.detach());

  const form = blessed.form({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '70%',
    height: '70%',
    keys: true,
    vi: true,
    mouse: true,
    border: { type: 'line', fg: 'white' },
    style: { bg: 'black' },
    label: ' Edit Note '
  });

  // Instructions box (top-right)
  blessed.box({
    parent: form,
    top: 0,
    right: 1,
    width: 'shrink',
    height: 'shrink',
    content: "Tab: switch fields\nEnter in Content: newline\nEsc/q: cancel",
    style: { fg: 'gray' }
  });

  blessed.text({
    parent: form,
    top: 1,
    left: 2,
    content: 'Title:',
    style: { fg: 'white' }
  });

  const titleInput = blessed.textbox({
    parent: form,
    name: 'title',
    top: 2,
    left: 2,
    width: '95%',
    height: 3,
    keys: true,
    vi: true,
    mouse: true,
    inputOnFocus: true,
    border: { type: 'line', fg: 'white' }
  });
  titleInput.setValue(note.title);

  blessed.text({
    parent: form,
    top: 6,
    left: 2,
    content: 'Content:',
    style: { fg: 'white' }
  });

  const contentInput = blessed.textarea({
    parent: form,
    name: 'content',
    top: 7,
    left: 2,
    width: '95%',
    height: '40%',
    keys: true,
    vi: true,
    mouse: true,
    inputOnFocus: true,
    border: { type: 'line', fg: 'white' },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      inverse: true
    }
  });
  contentInput.setValue(note.content);

  const saveButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    vi: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    bottom: 2,
    left: '35%',
    name: 'save',
    content: 'Save',
    style: {
      fg: 'white',
      bg: 'blue',
      focus: { bg: 'green' },
      hover: { bg: 'green' }
    }
  });

  const cancelButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    vi: true,
    shrink: true,
    padding: { left: 1, right: 1 },
    bottom: 2,
    left: '50%',
    name: 'cancel',
    content: 'Cancel',
    style: {
      fg: 'white',
      bg: 'red',
      focus: { bg: 'yellow' },
      hover: { bg: 'yellow' }
    }
  });

  // Arrow-key focus switching
  saveButton.key(['left', 'right'], () => {
    cancelButton.focus();
  });
  cancelButton.key(['left', 'right'], () => {
    saveButton.focus();
  });

  saveButton.on('press', () => form.submit());
  cancelButton.on('press', () => fullScreenListUI(screen));

  form.on('submit', data => {
    const updatedTitle = data.title?.trim();
    const updatedContent = data.content?.trim();
    if (!updatedTitle) {
      showMessage(screen, 'Title is required!', () => titleInput.focus());
    } else {
      notes.updateNote(note.id, { title: updatedTitle, content: updatedContent });
      showMessage(screen, 'Note updated successfully!', () => {
        fullScreenListUI(screen);
      });
    }
  });

  screen.key(['escape', 'q'], () => {
    fullScreenListUI(screen);
  });

  screen.render();
  titleInput.focus();
}

/**
 * Prompt for deletion confirmation.
 */
function confirmDeleteNote(screen, noteId) {
  const prompt = blessed.prompt({
    parent: screen,
    border: 'line',
    width: '50%',
    height: 'shrink',
    top: 'center',
    left: 'center',
    label: ' Confirm Deletion ',
    keys: true,
    vi: true
  });

  prompt.input('Type YES to delete the note:', '', (err, value) => {
    if (value === 'YES') {
      notes.deleteNote(noteId);
    }
    fullScreenListUI(screen);
  });
}

/**
 * Show a short message, then call a callback.
 */
function showMessage(screen, text, callback) {
  const msg = blessed.message({
    parent: screen,
    border: 'line',
    width: '50%',
    height: 'shrink',
    top: 'center',
    left: 'center',
    label: ' Info ',
    keys: true,
    vi: true
  });
  msg.display(text, 2, callback);
}
