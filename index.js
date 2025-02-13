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
  const instructions = blessed.box({
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
  
  // Create a new note
  screen.key(['n'], () => {
    createNoteUI(screen, noteList);
  });

  // Import file (not implemented, shows a message)
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
          notes.deleteNote(note.id);
          refreshNoteList(noteList, screen);
        }
        noteList.focus();
      });
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
 * Opens the selected note view.
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
    content: `Title: ${note.title}\n\nContent:\n${note.content}\n\nPress Esc to go back`,
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
}

/**
 * Displays prompts to create a new note and then refreshes the list.
 */
function createNoteUI(screen, noteList) {
  screen.children.forEach(child => child.detach());
  const titlePrompt = blessed.prompt({
    parent: screen,
    border: 'line',
    height: 'shrink',
    width: '50%',
    top: 'center',
    left: 'center',
    label: ' New Title ',
    keys: true,
    vi: true
  });
  titlePrompt.input('Enter the note title:', '', (err, title) => {
    if (err || title == null) {
      fullScreenListUI(screen);
      return;
    }
    const contentPrompt = blessed.prompt({
      parent: screen,
      border: 'line',
      height: 'shrink',
      width: '50%',
      top: 'center',
      left: 'center',
      label: ' New Content ',
      keys: true,
      vi: true
    });
    contentPrompt.input('Enter the note content:', '', (err, content) => {
      if (err || content == null) {
        fullScreenListUI(screen);
        return;
      }
      notes.createNote(title, content);
      fullScreenListUI(screen);
    });
  });
}
