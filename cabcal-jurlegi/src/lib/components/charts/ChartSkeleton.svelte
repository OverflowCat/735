<script lang="ts">
  import { SkeletonPlaceholder, SkeletonText } from 'carbon-components-svelte';
  let { label = '正在加载历史趋势' }: { label?: string } = $props();
</script>

<div class="chart-skeleton" role="status" aria-label={label} aria-busy="true">
  <div class="skeleton-legend">
    <SkeletonText width="96px" /><SkeletonText width="64px" />
  </div>
  <div class="skeleton-plot">
    <SkeletonPlaceholder width="100%" height="100%" />
  </div>
  <div class="skeleton-axis">
    <SkeletonText width="48px" /><SkeletonText width="48px" /><SkeletonText
      width="48px"
    />
  </div>
</div>

<style>
  .chart-skeleton {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    min-height: 160px;
    padding: 16px 8px 0;
  }
  .skeleton-legend,
  .skeleton-axis {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }
  .skeleton-legend {
    justify-content: flex-start;
    padding-left: 32px;
  }
  .skeleton-plot {
    flex: 1;
    min-height: 0;
    margin-left: 32px;
    border-left: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .skeleton-axis {
    margin-left: 32px;
  }
  .chart-skeleton :global(.bx--skeleton__text) {
    margin: 0;
  }
</style>
