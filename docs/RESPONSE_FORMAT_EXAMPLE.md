# RAG Response Format - Table Based

## New Response Format Example

When a user asks: **"What is LangGraph?"**

---

### 🤖 Answer

LangGraph is a powerful library that enables developers to build complex, stateful AI agents using a graph-based approach. It's part of the LangChain ecosystem and provides tools for creating sophisticated workflows that integrate Large Language Models (LLMs) with external tools and human-in-the-loop capabilities. LangGraph supports various patterns including ReAct, function calling, and agent with memory management, making it ideal for building production-grade AI applications.

---

### 📚 Retrieved Source Chunks

| # | Relevance | Document | Page | Similarity | Size | Content Preview |
|---|-----------|----------|------|------------|------|-----------------|
| 1 | ⭐⭐⭐⭐⭐ | langgraph_guide.pdf | 1 | 0.1523 | 987 | Understanding LangGraph LangGraph is a powerful library, which is a part of LangChain tools. It helps streamline the integration of... |
| 2 | ⭐⭐⭐⭐ | langgraph_guide.pdf | 1 | 0.2234 | 945 | Learn More: Dynamic AI Workflows Through LangGraph ReAct Function Calling Integration allows your AI agents to invoke external... |
| 3 | ⭐⭐⭐⭐ | langgraph_guide.pdf | 1 | 0.2847 | 1000 | Hi, I am Janvi, a passionate data science enthusiast currently working at Analytics Vidhya. My journey into the world of data... |
| 4 | ⭐⭐⭐ | langgraph_guide.pdf | 1 | 0.3512 | 892 | Frequently Asked Questions Q1. What is LangGraph? A. LangGraph is a powerful library that allows developers to make complex... |
| 5 | ⭐⭐ | langgraph_guide.pdf | 1 | 0.4123 | 756 | Part 4: Human-in-the-loop Sometimes, the AI agent might need human input before proceeding. We achieve this by creating a tool... |

---

### 📄 Document References

#### 📎 **langgraph_guide.pdf**

**Pages Referenced:** 1
**Chunks Used:** 5
**Total Characters:** 4,580

| Chunk | Page | Position | Score | Size | Content |
|-------|------|----------|-------|------|---------|
| #1 | 1 | Idx:0 | 0.152 (Perfect) | 987 | Understanding LangGraph LangGraph is a powerful library, which is... |
| #2 | 1 | Idx:5 | 0.223 (Excellent) | 945 | Learn More: Dynamic AI Workflows Through LangGraph ReAct Function... |
| #3 | 1 | Idx:8 | 0.285 (Good) | 1000 | Hi, I am Janvi, a passionate data science enthusiast currently... |
| #4 | 1 | Idx:12 | 0.351 (Fair) | 892 | Frequently Asked Questions Q1. What is LangGraph? A. LangGraph... |
| #5 | 1 | Idx:15 | 0.412 (Weak) | 756 | Part 4: Human-in-the-loop Sometimes, the AI agent might need... |

---

## Information Provided

### Main Chunks Table
Shows at a glance:
- **#**: Chunk sequence number (1-5)
- **Relevance**: Star rating based on similarity score
- **Document**: Source PDF filename
- **Page**: Physical page number in document
- **Similarity**: Exact cosine distance (lower = better match)
- **Size**: Character count of chunk
- **Content Preview**: First 80 characters of chunk text

### Document References Section
For each unique document:

1. **Document Header** (📎 filename)
   - Pages Referenced: Which pages were used
   - Chunks Used: How many chunks from this document
   - Total Characters: Sum of all chunk sizes

2. **Detailed Chunk Table**
   - **Chunk**: Reference number (#1-5)
   - **Page**: Page number
   - **Position**: Chunk index in document (Idx:N)
   - **Score**: Similarity score with quality label
     - Perfect: < 0.20
     - Excellent: < 0.30
     - Good: < 0.40
     - Fair: < 0.50
     - Weak: ≥ 0.50
   - **Size**: Characters in chunk
   - **Content**: First 60 characters of chunk text

---

## Key Improvements Over Previous Format

### Before
```
**Chunk 1** ⭐⭐⭐⭐⭐
- Page 1 (Score: 0.152)
- Understanding LangGraph LangGraph is a powerful library, which...
```

### After
```
| 1 | ⭐⭐⭐⭐⭐ | langgraph_guide.pdf | 1 | 0.1523 | 987 | Understanding LangGraph LangGraph is a powerful library... |
```

**Benefits:**
✅ **Organized in tables** - Easier to compare multiple chunks
✅ **More information** - Document name, exact score, size
✅ **Better scanning** - Aligned columns make it easy to read
✅ **Document context** - Shows which document each chunk came from
✅ **Position tracking** - Chunk index shows location in document
✅ **Quality labels** - "Perfect", "Excellent", etc. instead of just stars
✅ **Complete reference** - Full source attribution with pages and sizes

---

## Example with Multiple Documents

When chunks come from different PDFs:

```
### 📚 Retrieved Source Chunks

| # | Relevance | Document | Page | Similarity | Size | Content Preview |
|---|-----------|----------|------|------------|------|-----------------|
| 1 | ⭐⭐⭐⭐⭐ | machine_learning.pdf | 5 | 0.1234 | 1000 | Classification models are used when... |
| 2 | ⭐⭐⭐⭐⭐ | machine_learning.pdf | 6 | 0.1567 | 950 | Regression predicts continuous values... |
| 3 | ⭐⭐⭐⭐ | deep_learning.pdf | 12 | 0.2345 | 890 | Neural networks consist of layers... |
| 4 | ⭐⭐⭐ | nlp_basics.pdf | 3 | 0.3456 | 780 | Natural language processing involves... |
| 5 | ⭐⭐ | nlp_basics.pdf | 4 | 0.4567 | 650 | Transformers revolutionized NLP... |

---

### 📄 Document References

#### 📎 **machine_learning.pdf**

**Pages Referenced:** 5, 6
**Chunks Used:** 2
**Total Characters:** 1,950

| Chunk | Page | Position | Score | Size | Content |
|-------|------|----------|-------|------|---------|
| #1 | 5 | Idx:10 | 0.123 (Perfect) | 1000 | Classification models are used when predicting... |
| #2 | 6 | Idx:15 | 0.157 (Perfect) | 950 | Regression predicts continuous values in ML... |

#### 📎 **deep_learning.pdf**

**Pages Referenced:** 12
**Chunks Used:** 1
**Total Characters:** 890

| Chunk | Page | Position | Score | Size | Content |
|-------|------|----------|-------|------|---------|
| #3 | 12 | Idx:32 | 0.235 (Excellent) | 890 | Neural networks consist of interconnected layers... |

#### 📎 **nlp_basics.pdf**

**Pages Referenced:** 3, 4
**Chunks Used:** 2
**Total Characters:** 1,430

| Chunk | Page | Position | Score | Size | Content |
|-------|------|----------|-------|------|---------|
| #4 | 3 | Idx:8 | 0.346 (Good) | 780 | Natural language processing involves tokenization... |
| #5 | 4 | Idx:12 | 0.457 (Fair) | 650 | Transformers revolutionized NLP with attention... |
```

---

## Similarity Score Quality Guide

| Score Range | Label | Stars | Meaning |
|------------|-------|-------|---------|
| < 0.20 | Perfect | ⭐⭐⭐⭐⭐ | Excellent match, highly relevant |
| 0.20 - 0.30 | Excellent | ⭐⭐⭐⭐ | Very strong semantic similarity |
| 0.30 - 0.40 | Good | ⭐⭐⭐ | Good relevance, useful context |
| 0.40 - 0.50 | Fair | ⭐⭐ | Moderate relevance, somewhat useful |
| ≥ 0.50 | Weak | ⭐ | Weak match, tangentially related |

---

## Implementation Details

### Two-Tier Display

1. **Quick Overview Table**
   - Shows all 5 chunks side-by-side
   - Easy comparison of relevance scores
   - Document and page at a glance

2. **Detailed Document Section**
   - Organized by document
   - Shows pages referenced
   - Detailed chunk metadata
   - Position in document (chunk index)
   - Complete content preview

### Markdown Tables
- Clean, readable format
- Renders properly in chat interfaces
- Shows exact similarity scores (4 decimal places)
- No text truncation of critical info

### Content Preview
- First 80 chars in main table (identify chunk quickly)
- First 60 chars in detail table (save space)
- Newlines removed for readability
- Pipe characters replaced with bullets (•)

---

## Usage in Chat

```
User: "What is LangGraph and how does it work with function calling?"

[LLM generates contextual answer using the retrieved chunks]

[Tables show exactly which parts of which documents were used]

[User can click/expand to see full chunk text if needed]
```

This format provides complete transparency into the RAG system while maintaining readability and usability in chat interfaces.

