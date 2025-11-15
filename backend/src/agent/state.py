from typing import TypedDict, Annotated, Sequence
from operator import add
from langchain_core.messages import BaseMessage


def add_messages(left: Sequence[BaseMessage], right: Sequence[BaseMessage]) -> Sequence[BaseMessage]:
    """Merge message lists."""
    return list(left) + list(right)


class AgentState(TypedDict):
    """Simple agent state with only messages."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
