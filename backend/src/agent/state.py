from typing import Annotated, Sequence, TypedDict

from langchain_core.messages import BaseMessage


def add_messages(
    left: Sequence[BaseMessage], right: Sequence[BaseMessage]
) -> Sequence[BaseMessage]:
    """
    Merge message lists while preventing duplicate messages by ID.

    Uses message IDs as the deduplication key. If a message with the same ID
    exists in left, it won't be added again from right.
    """
    if not right:
        return list(left)

    left_list = list(left)
    if not left_list:
        return list(right)

    # Track all message IDs in left side
    # Only include non-None IDs for deduplication
    left_ids = {getattr(msg, 'id', None) for msg in left_list if getattr(msg, 'id', None) is not None}

    # Start with all left messages
    result = left_list.copy()

    # Add messages from right, but skip if their ID already exists in left
    for msg in right:
        msg_id = getattr(msg, 'id', None)

        # Add message if it has no ID (shouldn't happen, but handle it)
        # OR if its ID is not in left_ids
        if msg_id is None or msg_id not in left_ids:
            result.append(msg)

    return result


class AgentState(TypedDict):
    """Simple agent state with only messages."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
