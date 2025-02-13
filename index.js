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
 * Displays the full-screen main interface with the list of notes.
 */
function fullScreenListUI(screen) {
  // Remove existing elements
  screen.children.forEach(child => child.detach());

  // Create a list element to show the notes
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

  // Create an instruction bar at the bottom
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

  // Load and display the list of notes
  refreshNoteList(noteList, screen);

  noteList.focus();
  screen.render();

  // Global keys
  screen.key(['q'], () => process.exit(0));
  
  // Create a new note (with multiline editor)
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

  // When Enter is pressed on a note, open it
  noteList.on('select', (item, index) => {
    if (noteList.notes && noteList.notes[index]) {
      openNoteUI(screen, noteList.notes[index]);
    }
  });
}

/**
 * Refreshes the note list in the noteList element.
 */
function refreshNoteList(noteList, screen) {
  const allNotes = notes.getAllNotes();
  // Save note objects for later reference
  noteList.notes = allNotes;
  const items = allNotes.map((note, index) => {
    // Format: "Number. Title (Date) [🗑]"
    return `${index + 1}. ${note.title} (${note.created_at.slice(0, 10)}) [🗑]`;
  });
  noteList.setItems(items);
  screen.render();
}

/**
 * Opens the selected note view (read-only), with the option to edit (press 'e').
 */
function openNoteUI(screen, note) {
  // Clear the screen
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

  // Return to list on Esc or q
  box.key(['escape', 'q'], () => {
    fullScreenListUI(screen);
  });

  // Press e to edit
  box.key(['e'], () => {
    editNoteUI(screen, note);
  });
}

/**
 * Displays a form to create a new note (multiline content).
 */
function createNoteUI(screen) {
  screen.children.forEach(child => child.detach());

  const form = blessed.form({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '80%',
    height: '80%',
    keys: true,
    vi: true,
    mouse: true,
    border: { type: 'line' },
    label: ' New Note '
  });

  blessed.text({
    parent: form,
    top: 1,
    left: 2,
    content: 'Title:'
  });

  const titleInput = blessed.textarea({
    parent: form,
    name: 'title',
    top: 2,
    left: 2,
    width: '90%',
    height: 3,
    keys: true,
    vi: true,
    inputOnFocus: true,
    border: { type: 'line' }
  });

  blessed.text({
    parent: form,
    top: 6,
    left: 2,
    content: 'Content:'
  });

  const contentInput = blessed.textarea({
    parent: form,
    name: 'content',
    top: 7,
    left: 2,
    width: '90%',
    height: '60%',
    keys: true,
    vi: true,
    inputOnFocus: true,
    border: { type: 'line' }
  });

  const submitButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    vi: true,
    shrink: true,
    padding: {
      left: 1,
      right: 1
    },
    left: 'center',
    bottom: 2,
    name: 'submit',
    content: 'Submit',
    style: {
      bg: 'blue',
      focus: {
        bg: 'green'
      },
      hover: {
        bg: 'green'
      }
    }
  });

  submitButton.on('press', () => {
    form.submit();
  });

  form.on('submit', data => {
    const title = data.title?.trim();
    const content = data.content?.trim();
    if (!title) {
      showMessage(screen, 'Title is required!', () => {
        titleInput.focus();
      });
    } else {
      notes.createNote(title, content);
      showMessage(screen, 'Note created successfully!', () => {
        fullScreenListUI(screen);
      });
    }
  });

  // Press Esc or q to go back
  screen.key(['escape', 'q'], () => {
    fullScreenListUI(screen);
  });

  screen.render();
  titleInput.focus();
}

/**
 * Displays a form to edit an existing note (multiline content).
 */
function editNoteUI(screen, note) {
  screen.children.forEach(child => child.detach());

  const form = blessed.form({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '80%',
    height: '80%',
    keys: true,
    vi: true,
    mouse: true,
    border: { type: 'line' },
    label: ' Edit Note '
  });

  blessed.text({
    parent: form,
    top: 1,
    left: 2,
    content: 'Title:'
  });

  const titleInput = blessed.textarea({
    parent: form,
    name: 'title',
    top: 2,
    left: 2,
    width: '90%',
    height: 3,
    keys: true,
    vi: true,
    inputOnFocus: true,
    border: { type: 'line' }
  });

  titleInput.setValue(note.title);

  blessed.text({
    parent: form,
    top: 6,
    left: 2,
    content: 'Content:'
  });

  const contentInput = blessed.textarea({
    parent: form,
    name: 'content',
    top: 7,
    left: 2,
    width: '90%',
    height: '60%',
    keys: true,
    vi: true,
    inputOnFocus: true,
    border: { type: 'line' }
  });

  contentInput.setValue(note.content);

  const submitButton = blessed.button({
    parent: form,
    mouse: true,
    keys: true,
    vi: true,
    shrink: true,
    padding: {
      left: 1,
      right: 1
    },
    left: 'center',
    bottom: 2,
    name: 'submit',
    content: 'Save',
    style: {
      bg: 'blue',
      focus: {
        bg: 'green'
      },
      hover: {
        bg: 'green'
      }
    }
  });

  submitButton.on('press', () => {
    form.submit();
  });

  form.on('submit', data => {
    const updatedTitle = data.title?.trim();
    const updatedContent = data.content?.trim();
    if (!updatedTitle) {
      showMessage(screen, 'Title is required!', () => {
        titleInput.focus();
      });
    } else {
      notes.updateNote(note.id, { title: updatedTitle, content: updatedContent });
      showMessage(screen, 'Note updated successfully!', () => {
        fullScreenListUI(screen);
      });
    }
  });

  // Press Esc or q to go back
  screen.key(['escape', 'q'], () => {
    fullScreenListUI(screen);
  });

  screen.render();
  titleInput.focus();
}

/**
 * Asks for confirmation before deleting a note.
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
 * Helper to show a short message box, then do a callback.
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
