import { Plugin } from 'obsidian';

export default class ObsidianGanttPlugin extends Plugin {
  async onload() {
    console.log('obsidian-gantt: onload');
    // TODO: register Bases custom view (type: obsidian-gantt)
  }

  onunload() {
    console.log('obsidian-gantt: onunload');
  }
}

