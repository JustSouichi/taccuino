#!/usr/bin/env node
import { program } from 'commander';
import blessed from 'blessed';
import figlet from 'figlet';
import * as notes from './src/notes.js';

/**
 * THEME DEFINITION
 */
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

/**
 * Layout constants
 */
const BANNER_HEIGHT = 9;      // for "Shadow" font in figlet
const BOTTOM_BAR_HEIGHT = 3;  // instruction bar at bottom

/**
 * CLI CONFIG (Commander)
 */
program
  .version('1.0.0')
  .description('Taccuino - CLI Note Manager');

program
  .command('open')
  .description('Open the Taccuino full-screen interface')
  .action(() => {
    openUI();
  });

program.parse(process.argv);

/**
 * OPEN UI
 * Creates the main screen, banner, bottom bar, main area, then shows the note list.
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

  // 1) TOP BANNER (ASCII)
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

  // 2) BOTTOM BAR
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

  // 3) MAIN AREA
  const mainArea = blessed.box({
    parent: layout,
    top: BANNER_HEIGHT,
    left: 0,
    width: '100%',
    height: `100%-${BANNER_HEIGHT + BOTTOM_BAR_HEIGHT}`,
    style: { fg: theme.foreground, bg: theme.background }
  });

  // Show the note list
  showNoteList(screen, mainArea);

  // Allow exit with Ctrl-C
  screen.key(['C-c'], () => process.exit(0));

  // Responsive resizing
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

  let allNotes = [];
  try {
    allNotes = notes.getAllNotes();
  } catch (error) {
    return showError(screen, `Error reading notes: ${error.message}`, () => {
      allNotes = [];
    });
  }

  noteList.notes = allNotes;
  const items = allNotes.map((note, index) => {
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
        notes.createNote(title, content);
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
        notes.updateNote(note.id, { title: updatedTitle, content: updatedContent });
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
        notes.deleteNote(noteId);
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
 * SHOW SEARCH PROMPT (FORM-BASED with "Okay" & "Cancel")
 */
function showSearchPrompt(screen, mainArea) {
  mainArea.children.forEach(child => child.detach());

  // Create a form for searching
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

  // Label
  blessed.text({
    parent: form,
    top: 1,
    left: 1,
    content: 'Enter search query:',
    style: { fg: theme.foreground, bg: theme.background }
  });

  // Textbox for the query
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
      fg: theme.primaryFg,
      bg: theme.primaryBg,
      focus: { bg: theme.highlightBg, fg: theme.highlightFg },
      hover: { bg: theme.highlightBg, fg: theme.highlightFg }
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
      fg: theme.secondaryFg,
      bg: theme.secondaryBg,
      focus: { bg: theme.highlightBg, fg: theme.highlightFg },
      hover: { bg: theme.highlightBg, fg: theme.highlightFg }
    }
  });

  // Arrow-key switching between "Okay" and "Cancel"
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

  // On form submit
  form.on('submit', data => {
    const query = (data.query || '').trim();
    if (!query) {
      showNoteList(screen, mainArea);
      return;
    }

    let results = [];
    try {
      results = notes.searchNotes(query);
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

  // Esc/q to cancel
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

/**
 * SHOW MESSAGE
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
 * SHOW ERROR
 */
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