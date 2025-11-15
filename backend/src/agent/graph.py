from langgraph.graph import StateGraph, END, START
from src.agent.state import AgentState
from src.agent.nodes import route_message, process_pdf_node, chat_node


# Create the graph
workflow = StateGraph(AgentState)

# Add nodes (no route node - route_message is just a conditional function)
workflow.add_node("process_pdf", process_pdf_node)
workflow.add_node("chat", chat_node)

# Add conditional edges from START based on message type
workflow.add_conditional_edges(
    START,
    route_message,  # Function that returns next node name
    {
        "process_pdf": "process_pdf",
        "chat": "chat"
    }
)

# Add edges to END
workflow.add_edge("process_pdf", END)
workflow.add_edge("chat", END)

# Compile (LangGraph API handles persistence automatically)
graph = workflow.compile()
