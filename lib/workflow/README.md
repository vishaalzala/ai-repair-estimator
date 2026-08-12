# Workflow service

Mutations that affect workshop workflow state should flow through shared helpers under `lib/workflow` so Daily Jobs and detailed module pages do not drift apart. UI pages may read directly from the native module tables, but duplicated workflow status columns should not be introduced.