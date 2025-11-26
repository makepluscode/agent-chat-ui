from langgraph.graph import END, START, StateGraph

from src.agent.nodes import chat_node, clear_db_node, process_pdf_node, route_message
from src.agent.state import AgentState

# Create the graph
workflow = StateGraph(AgentState)

# Add nodes (no route node - route_message is just a conditional function)
workflow.add_node("process_pdf", process_pdf_node)
workflow.add_node("clear_db", clear_db_node)
workflow.add_node("chat", chat_node)

# Add conditional edges from START based on message type
workflow.add_conditional_edges(
    START,
    route_message,  # Function that returns next node name
    {
        "process_pdf": "process_pdf",
        "clear_db": "clear_db",
        "chat": "chat"
    }
)

# Add edges to END
workflow.add_edge("process_pdf", END)
workflow.add_edge("clear_db", END)
workflow.add_edge("chat", END)

# Compile (LangGraph API handles persistence automatically)
graph = workflow.compile()
