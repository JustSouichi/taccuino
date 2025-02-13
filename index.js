#!/usr/bin/env node
import { program } from 'commander';
import blessed from 'blessed';
import * as notes from './src/notes.js';

/**
 * Configure CLI with Commander
 */
program
  .version('1.0.0')
  .description('Taccuino - CLI Note Manager');

/**
 * "open" command: launch the full-screen interface
 */
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
 * MAIN LIST UI
 * Displays the list of notes, with keys for create, search, delete, etc.
 */
function fullScreenListUI(screen) {
  // Clear existing elements
  screen.children.forEach(child => child.detach());

  // Create the note list
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

  // Instruction bar
  blessed.box({
    parent: screen,
    bottom: 0,
    left: 'center',
    width: '90%',
    height: 3,
    content: "Enter: Open note | n: New note | s: Search | i: Import file | d: Delete note | q: Quit",
    border: { type: 'line' },
    align: 'center'
  });

  // Populate the list
  refreshNoteList(noteList, screen);

  noteList.focus();
  screen.render();

  // Global keys
  screen.key(['q'], () => process.exit(0));

  // Create a new note
  screen.key(['n'], () => {
    createNoteUI(screen);
  });

  // Search notes
  screen.key(['s'], () => {
    searchNotesUI(screen);
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

  // Delete the selected note (NEW: uses confirmDeleteNoteUI)
  screen.key(['d'], () => {
    const selectedIndex = noteList.selected;
    if (noteList.notes && noteList.notes[selectedIndex]) {
      const note = noteList.notes[selectedIndex];
      confirmDeleteNoteUI(screen, note.id);
    }
  });

  // Open the selected note
  noteList.on('select', (item, index) => {
    if (noteList.notes && noteList.notes[index]) {
      openNoteUI(screen, noteList.notes[index]);
    }
  });
}

/**
 * Refreshes the main note list items
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
 * OPEN NOTE UI
 * Displays a single note in read-only mode. Press 'e' to edit.
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

  // Press e to edit
  box.key(['e'], () => {
    editNoteUI(screen, note);
  });
}

/**
 * CREATE NOTE UI
 * Form for creating a new note, with multiline content.
 * No vi: true, and explicit style for text color.
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

  // Title label
  blessed.text({
    parent: form,
    top: 1,
    left: 2,
    content: 'Title:',
    style: { fg: 'white' }
  });

  // Title input (single-line)
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
    border: { type: 'line', fg: 'white' },
    style: {
      fg: 'white',
      bg: 'black'
    }
  });

  // Content label
  blessed.text({
    parent: form,
    top: 6,
    left: 2,
    content: 'Content:',
    style: { fg: 'white' }
  });

  // Content input (multiline)
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
    border: { type: 'line', fg: 'white' },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      inverse: true
    },
    style: {
      fg: 'white',
      bg: 'black'
    }
  });

  // Submit button
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
      fg: 'white',
      bg: 'blue',
      focus: { bg: 'green' },
      hover: { bg: 'green' }
    }
  });

  // Cancel button
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
      fg: 'white',
      bg: 'red',
      focus: { bg: 'yellow' },
      hover: { bg: 'yellow' }
    }
  });

  // Arrow-key focus switching
  submitButton.key(['left', 'right'], () => {
    cancelButton.focus();
  });
  cancelButton.key(['left', 'right'], () => {
    submitButton.focus();
  });

  submitButton.on('press', () => form.submit());
  cancelButton.on('press', () => fullScreenListUI(screen));

  // On form submit
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

  // Esc or q to cancel
  screen.key(['escape', 'q'], () => {
    fullScreenListUI(screen);
  });

  screen.render();
  titleInput.focus();
}

/**
 * EDIT NOTE UI
 * Similar to createNoteUI, but pre-fills the fields and updates an existing note.
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

  // Title label
  blessed.text({
    parent: form,
    top: 1,
    left: 2,
    content: 'Title:',
    style: { fg: 'white' }
  });

  // Title input
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
    border: { type: 'line', fg: 'white' },
    style: {
      fg: 'white',
      bg: 'black'
    }
  });
  titleInput.setValue(note.title);

  // Content label
  blessed.text({
    parent: form,
    top: 6,
    left: 2,
    content: 'Content:',
    style: { fg: 'white' }
  });

  // Content input
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
    border: { type: 'line', fg: 'white' },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      inverse: true
    },
    style: {
      fg: 'white',
      bg: 'black'
    }
  });
  contentInput.setValue(note.content);

  // Save button
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
      fg: 'white',
      bg: 'blue',
      focus: { bg: 'green' },
      hover: { bg: 'green' }
    }
  });

  // Cancel button
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

  // Esc or q to go back
  screen.key(['escape', 'q'], () => {
    fullScreenListUI(screen);
  });

  screen.render();
  titleInput.focus();
}
function confirmDeleteNoteUI(screen, noteId) {
    // Clear existing elements
    screen.children.forEach(child => child.detach());
  
    // Create a form-based UI
    const form = blessed.form({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 'shrink', // auto-resize so everything is visible
      keys: true,
      mouse: true,
      border: { type: 'line', fg: 'white' },
      style: { bg: 'black' }, // background for the form
      label: ' Confirm Deletion '
    });
  
    // Instruction text: "Type YES to delete the note:"
    const label = blessed.text({
      parent: form,
      top: 1,
      left: 1,
      width: '90%',
      height: 'shrink',
      content: 'Type YES to delete the note:',
      style: { fg: 'white', bg: 'black' }
    });
  
    // Force a render here to ensure the label is drawn
    screen.render();
  
    // Textbox for typing "YES"
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
      border: { type: 'line', fg: 'white' },
      style: {
        fg: 'white',
        bg: 'black'
      }
    });
    input.focus(); // immediately focus so user can type
  
    // "Okay" button
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
        fg: 'white',
        bg: 'blue',
        focus: { bg: 'green' },
        hover: { bg: 'green' }
      }
    });
  
    // "Cancel" button
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
        fg: 'white',
        bg: 'red',
        focus: { bg: 'yellow' },
        hover: { bg: 'yellow' }
      }
    });
  
    // Arrow-key focus switching between Okay and Cancel
    okayButton.key(['left', 'right'], () => {
      cancelButton.focus();
    });
    cancelButton.key(['left', 'right'], () => {
      okayButton.focus();
    });
  
    // Button actions
    okayButton.on('press', () => {
      form.submit();
    });
    cancelButton.on('press', () => {
      fullScreenListUI(screen); // return to main list
    });
  
    // On form submission
    form.on('submit', data => {
      // If typed "YES" exactly, delete the note
      if ((data.confirm || '').trim() === 'YES') {
        notes.deleteNote(noteId);
      }
      fullScreenListUI(screen);
    });
  
    // Press Esc or q to return without deleting
    screen.key(['escape', 'q'], () => {
      fullScreenListUI(screen);
    });
  
    screen.render();
  }
/*  
 * SEARCH NOTES UI
 * Press "s" in the main list to prompt for a query, then show results.
 */
function searchNotesUI(screen) {
  // Clear screen
  screen.children.forEach(child => child.detach());

  // Prompt for a search query
  const prompt = blessed.prompt({
    parent: screen,
    border: 'line',
    width: '50%',
    height: 'shrink',
    top: 'center',
    left: 'center',
    label: ' Search Notes ',
    keys: true,
    vi: true,
    mouse: true
  });

  prompt.input('Enter search query:', '', (err, query) => {
    if (!query) {
      fullScreenListUI(screen);
      return;
    }
    const results = notes.searchNotes(query);
    if (!results || results.length === 0) {
      showMessage(screen, 'No matching notes found.', () => {
        fullScreenListUI(screen);
      });
    } else {
      showSearchResults(screen, results);
    }
  });
}

/**
 * SHOW SEARCH RESULTS
 * Displays matching notes in a list, similar to main list.
 */
function showSearchResults(screen, results) {
  screen.children.forEach(child => child.detach());

  const resultsList = blessed.list({
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
    content: "Enter: Open note | d: Delete note | q/Esc: Back",
    border: { type: 'line' },
    align: 'center'
  });

  resultsList.notes = results;
  const items = results.map((note, index) => {
    return `${index + 1}. ${note.title} (${note.created_at.slice(0, 10)})`;
  });
  resultsList.setItems(items);

  resultsList.focus();
  screen.render();

  // Press q/Esc to go back
  screen.key(['q', 'escape'], () => {
    fullScreenListUI(screen);
  });

  // Press d to delete (NEW: uses confirmDeleteNoteUI)
  screen.key(['d'], () => {
    const selectedIndex = resultsList.selected;
    if (resultsList.notes && resultsList.notes[selectedIndex]) {
      const note = resultsList.notes[selectedIndex];
      confirmDeleteNoteUI(screen, note.id);
    }
  });

  // Press Enter to open a note
  resultsList.on('select', (item, index) => {
    if (resultsList.notes && resultsList.notes[index]) {
      openNoteUI(screen, resultsList.notes[index]);
    }
  });
}
