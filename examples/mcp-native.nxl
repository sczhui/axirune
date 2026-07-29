space mcp_native

edition 1

capability repository.read
  effect network.read
  resource «mcp://codegraph»
/capability

mcp codegraph
  transport stdio
  command «gitnexus mcp»
  protocol «2025-06-18»
  import tool query_graph
  import resource repository_context
  need repository.read
/mcp

task main
  give Text
  use codegraph.query_graph
  let graph = [call codegraph.query_graph :query «calls:CheckoutService»]
  emit «MCP response passed schema and capability checks.»
  yield graph
/task

launch main
