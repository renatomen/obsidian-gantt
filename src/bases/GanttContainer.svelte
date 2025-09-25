<script lang="ts">
  import Gantt from '@svar-ui/svelte-gantt';

  // For OG-23 we use dummy data rendered inside Bases view
  type Task = { id: string; text: string; start: Date; end: Date };
  export let tasks: Task[] = [
    { id: 'A', text: 'Design', start: new Date('2025-01-01'), end: new Date('2025-01-05') },
    { id: 'B', text: 'Build',  start: new Date('2025-01-06'), end: new Date('2025-01-12') },
    { id: 'C', text: 'Test',   start: new Date('2025-01-13'), end: new Date('2025-01-16') },
  ];
</script>

<!-- Minimal container; library defaults should render a basic chart -->
<div class="og-bases-gantt">
  <Gantt {tasks} />
</div>

<style>
  .og-bases-gantt { height: 100%; width: 100%; }
</style>

