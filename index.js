#!/usr/bin/env node
import { program } from 'commander';
import blessed from 'blessed';
import figlet from 'figlet';
import * as notes from './src/notes.js';

/**
 * THEME DEFINITION
 * Change these colors to quickly re-style your app.
 */
const theme = {
  background: 'black',
  foreground: 'white',
  borderFg: 'white',

  primaryBg: 'blue',
  primaryFg: 'white',

  secondaryBg: 'red',
  secondaryFg: 'white',

  highlightBg: 'green',
  highlightFg: 'white',

  instructionFg: 'gray'
};

/**
 * CLI CONFIGURATION (Commander)
 */
program
  .version('1.0.0')
  .description('Taccuino - CLI Note Manager');

/**
 * "open" command: starts the UI
 */
program
  .command('open')
  .description('Open the Taccuino full-screen interface')
  .action(() => {
    openUI();
  });

program.parse(process.argv);

/**
 * OPEN UI
 * Sets up the main screen, banner, bottom bar, and calls showNoteList() in the main area.
 */
function openUI() {
  // Create the Blessed screen
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Taccuino'
  });

  // The root container for everything
  const layout = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    style: {
      fg: theme.foreground,
      bg: theme.background
    }
  });

  // 1) TOP BANNER with ASCII text
  const bannerText = figlet.textSync('Taccuino', { font: 'Standard' });
  const banner = blessed.box({
    parent: layout,
    top: 0,
    left: 'center',
    width: '100%',
    height: 'shrink',
    content: bannerText,
    align: 'center',
    style: {
      fg: theme.foreground,
      bg: theme.background
    }
  });

  // 2) MAIN AREA (where we show the list, forms, etc.)
  // We'll place it below the banner (about 8 rows)
  const mainArea = blessed.box({
    parent: layout,
    top: 8,
    left: 0,
    width: '100%',
    height: '75%',
    style: {
      fg: theme.foreground,
      bg: theme.background
    }
  });

  // 3) BOTTOM BAR (for instructions)
  const instructionBar = blessed.box({
    parent: layout,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line', fg: theme.borderFg },
    style: {
      fg: theme.instructionFg,
      bg: theme.background
    },
    align: 'center',
    content: 'Enter: Open | n: New | s: Search | d: Delete | q: Quit'
  });

  // Show the note list in the mainArea
  showNoteList(screen, mainArea);

  // Allow exit with Ctrl-C
  screen.key(['C-c'], () => process.exit(0));

  // Render once at the end
  screen.render();
}

/**
 * SHOW NOTE LIST
 * Lists all notes in the main area. Pressing n, s, d, etc. triggers further actions.
 */
function showNoteList(screen, mainArea) {
  // Clear the mainArea only (not the entire screen)
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
        bg: theme.primaryBg,
        fg: theme.primaryFg
      }
    },
    items: []
  });

  // Populate the list with notes
  const allNotes = notes.getAllNotes();
  noteList.notes = allNotes;
  const items = allNotes.map((note, index) => {
    return `${index + 1}. ${note.title} (${note.created_at.slice(0, 10)}) [🗑]`;
  });
  noteList.setItems(items);

  noteList.focus();
  screen.render();

  // Key bindings
  screen.key(['q'], () => process.exit(0));
  screen.key(['n'], () => {
    showCreateNoteForm(screen, mainArea);
  });
  screen.key(['s'], () => {
    showSearchPrompt(screen, mainArea);
  });
  screen.key(['d'], () => {
    const selectedIndex = noteList.selected;
    if (noteList.notes && noteList.notes[selectedIndex]) {
      const note = noteList.notes[selectedIndex];
      confirmDeleteNoteUI(screen, mainArea, note.id);
    }
  });

  // Press Enter on a note to open it
  noteList.on('select', (item, index) => {
    if (noteList.notes && noteList.notes[index]) {
      showNoteView(screen, mainArea, noteList.notes[index]);
    }
  });
}

/**
 * SHOW NOTE VIEW (Read-only). Press e to edit, Esc/q to go back to the list.
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
 * SHOW CREATE NOTE FORM
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

  // Title label
  blessed.text({
    parent: form,
    top: 1,
    left: 2,
    content: 'Title:',
    style: { fg: theme.foreground, bg: theme.background }
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
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background }
  });

  // Content label
  blessed.text({
    parent: form,
    top: 6,
    left: 2,
    content: 'Content:',
    style: { fg: theme.foreground, bg: theme.background }
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
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background },
    scrollable: true,
    alwaysScroll: true
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
      fg: theme.primaryFg,
      bg: theme.primaryBg,
      focus: { bg: theme.highlightBg },
      hover: { bg: theme.highlightBg }
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
      fg: theme.secondaryFg,
      bg: theme.secondaryBg,
      focus: { bg: theme.highlightBg },
      hover: { bg: theme.highlightBg }
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
      notes.createNote(title, content);
      showMessage(screen, 'Note created successfully!', () => {
        showNoteList(screen, mainArea);
      });
    }
  });

  // Esc or q to cancel
  screen.key(['escape', 'q'], () => {
    showNoteList(screen, mainArea);
  });

  screen.render();
  titleInput.focus();
}

/**
 * SHOW EDIT NOTE FORM
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

  // Title label
  blessed.text({
    parent: form,
    top: 1,
    left: 2,
    content: 'Title:',
    style: { fg: theme.foreground, bg: theme.background }
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
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background }
  });
  titleInput.setValue(note.title);

  // Content label
  blessed.text({
    parent: form,
    top: 6,
    left: 2,
    content: 'Content:',
    style: { fg: theme.foreground, bg: theme.background }
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
    border: { type: 'line', fg: theme.borderFg },
    style: { fg: theme.foreground, bg: theme.background },
    scrollable: true,
    alwaysScroll: true
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
      fg: theme.primaryFg,
      bg: theme.primaryBg,
      focus: { bg: theme.highlightBg },
      hover: { bg: theme.highlightBg }
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
      fg: theme.secondaryFg,
      bg: theme.secondaryBg,
      focus: { bg: theme.highlightBg },
      hover: { bg: theme.highlightBg }
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
      notes.updateNote(note.id, { title: updatedTitle, content: updatedContent });
      showMessage(screen, 'Note updated successfully!', () => {
        showNoteList(screen, mainArea);
      });
    }
  });

  // Esc or q to go back
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

  // Okay button
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
      focus: { bg: theme.highlightBg },
      hover: { bg: theme.highlightBg }
    }
  });

  // Cancel button
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
      focus: { bg: theme.highlightBg },
      hover: { bg: theme.highlightBg }
    }
  });

  // Arrow-key focus switching
  okayButton.key(['left', 'right'], () => {
    cancelButton.focus();
  });
  cancelButton.key(['left', 'right'], () => {
    okayButton.focus();
  });

  okayButton.on('press', () => form.submit());
  cancelButton.on('press', () => {
    showNoteList(screen, mainArea);
  });

  form.on('submit', data => {
    if ((data.confirm || '').trim() === 'YES') {
      notes.deleteNote(noteId);
      showMessage(screen, 'Note deleted.', () => {
        showNoteList(screen, mainArea);
      });
    } else {
      showNoteList(screen, mainArea);
    }
  });

  // Esc/q to return
  screen.key(['escape', 'q'], () => {
    showNoteList(screen, mainArea);
  });

  screen.render();
}

/**
 * SHOW MESSAGE
 * Displays a short message, then calls a callback.
 */
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

/**
 * SEARCH PROMPT
 */
function showSearchPrompt(screen, mainArea) {
  mainArea.children.forEach(child => child.detach());

  const prompt = blessed.prompt({
    parent: mainArea,
    border: { type: 'line', fg: theme.borderFg },
    width: '50%',
    height: 'shrink',
    top: 'center',
    left: 'center',
    label: ' Search Notes ',
    keys: true,
    vi: true,
    mouse: true,
    style: { fg: theme.foreground, bg: theme.background }
  });

  prompt.input('Enter search query:', '', (err, query) => {
    if (!query) {
      showNoteList(screen, mainArea);
      return;
    }
    const results = notes.searchNotes(query);
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
        bg: theme.primaryBg,
        fg: theme.primaryFg
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
    const selectedIndex = resultsList.selected;
    if (resultsList.notes && resultsList.notes[selectedIndex]) {
      const note = resultsList.notes[selectedIndex];
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
