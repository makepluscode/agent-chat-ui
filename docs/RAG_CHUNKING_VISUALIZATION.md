# RAG Chunking Process - Visual Guide

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│  User uploads PDF | User asks question | See answer + sources   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    LangGraph API (http://localhost:2024)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     BACKEND (LangGraph)                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Message Router (route_message)                  │   │
│  │  - PDF in message? → process_pdf_node                  │   │
│  │  - Text query? → chat_node (with RAG)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│               │                              │                   │
│               ▼                              ▼                   │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │  process_pdf_node        │  │  chat_node (NEW: RAG)        │ │
│  ├──────────────────────────┤  ├──────────────────────────────┤ │
│  │ 1. Extract PDF           │  │ 1. Get user query            │ │
│  │ 2. Chunk text            │  │ 2. Embed query (BGE-M3)      │ │
│  │ 3. Generate embeddings   │  │ 3. Search ChromaDB (top 5)   │ │
│  │ 4. Store in ChromaDB     │  │ 4. Build context from chunks │ │
│  │                          │  │ 5. Send to LLM with context  │ │
│  │ Output: Processing info  │  │ 6. Format response + sources │ │
│  │ + PDFs searchable        │  │                              │ │
│  │                          │  │ Output: Answer + chunk info  │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
│               │                              │                   │
│               └──────────────┬───────────────┘                   │
│                              │                                    │
│                  ┌───────────▼─────────────┐                     │
│                  │ ChromaDB (Vector Store) │                     │
│                  ├────────────────────────┤                     │
│                  │ • 138 chunks           │                     │
│                  │ • 1024-dim embeddings  │                     │
│                  │ • Metadata (page, src) │                     │
│                  │ • HNSW index           │                     │
│                  │ • Persistent storage   │                     │
│                  │   (./chroma_db/)       │                     │
│                  └────────────────────────┘                     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Embedding Service                          │   │
│  │  Model: BAAI/bge-m3                                     │   │
│  │  Supports: Korean, English, 100+ languages             │   │
│  │  Output: 1024-dimensional vectors                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              LLM (Ollama)                               │   │
│  │  Model: gemma3:12b (local)                              │   │
│  │  Input: User query + document chunks                   │   │
│  │  Output: Contextual answer                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## PDF Upload → Processing → Storage

```
PDF: machine_learning_guide.pdf (50 pages, 125,000 chars)

STEP 1: Extract Text (pypdf)
┌──────────────────────────────────────┐
│ Page 1: "Intro to ML..." (2,500 chars)│
│ Page 2: "History..." (2,400 chars)    │
│ ...                                   │
│ Page 50: "Conclusion..." (2,300 chars)│
│ TOTAL: 125,000 characters             │
└──────────────────────────────────────┘

STEP 2: Chunk with Overlap (1000 chars, 200 overlap)
┌───────────────────────────────────────────────────┐
│ CHUNK 0 [950 chars] ════════════════════════      │
│ "Intro to ML... Supervised learning..."           │
└───────────────────────────────────────────────────┘
        └─ OVERLAP (200 chars) ─┘
                                ┌───────────────────┐
                                │ CHUNK 1 [980 chars]│
                                │ "Supervised learn."│
                                │ "Uses labeled data"│
                                └───────────────────┘
                                    └─ OVERLAP ─┘
                                              ┌──────────┐
                                              │ CHUNK 2  │
                                              │ [1000]   │
                                              │ ...      │
                                              └──────────┘
                                    ... continues for ~138 chunks

Result: 138 chunks total
- Average size: 906 characters
- Each chunk maintains semantic integrity
- Boundary concepts preserved by overlap

STEP 3: Generate Embeddings (BGE-M3)
Chunk 0  → [0.234, -0.125, 0.891, ..., -0.456]  (1024 dims)
Chunk 1  → [0.156, -0.234, 0.678, ..., -0.234]  (1024 dims)
Chunk 2  → [0.423, -0.876, 0.123, ..., -0.567]  (1024 dims)
...
Chunk 137 → [0.789, -0.345, 0.234, ..., -0.678]  (1024 dims)

Processing time: 2-3 seconds on CPU

STEP 4: Store in ChromaDB
┌────────────────────────────────────────────────┐
│ ChromaDB Collection: "pdf_documents"           │
├────────────────────────────────────────────────┤
│ ID: machine_learning_guide.pdf_0_0             │
│ ├─ Text: "Intro to ML..."                      │
│ ├─ Embedding: [0.234, -0.125, 0.891, ...]     │
│ ├─ Metadata:                                   │
│ │  ├─ filename: "machine_learning_guide.pdf"   │
│ │  ├─ page: 1                                  │
│ │  ├─ chunk_index: 0                           │
│ │  ├─ chunk_size: 950                          │
│ │  └─ created_at: "2025-11-23T10:30:00"        │
│ │                                              │
│ ID: machine_learning_guide.pdf_1_1             │
│ ├─ Text: "Uses labeled data..."                │
│ ├─ Embedding: [0.156, -0.234, 0.678, ...]     │
│ ├─ Metadata:                                   │
│ │  ├─ filename: "machine_learning_guide.pdf"   │
│ │  ├─ page: 2                                  │
│ │  ├─ chunk_index: 1                           │
│ │  ├─ chunk_size: 980                          │
│ │  └─ created_at: "2025-11-23T10:30:05"        │
│ │                                              │
│ ... (136 more chunks)                          │
│                                              │
│ Index Type: HNSW (Hierarchical Navigable SW)  │
│ Similarity: Cosine distance                    │
│ Storage: ./chroma_db/ (persistent)             │
└────────────────────────────────────────────────┘
```

---

## Query → Search → Retrieve → Answer

```
USER QUERY: "What are the main types of supervised learning?"

STEP 1: Embed Query (BGE-M3)
Input:  "What are the main types of supervised learning?"
        │
        ├─ Tokenize
        ├─ Pass through BGE-M3 encoder
        │
Output: [0.178, -0.234, 0.845, ..., -0.321]  (1024 dims)
        Processing time: 20-50ms

STEP 2: Search ChromaDB (HNSW Index)
Query embedding: [0.178, -0.234, 0.845, ..., -0.321]

Cosine Distance Calculation:
distance(query, chunk) = 1 - (dot_product / (norm_a × norm_b))

Search Result (Top 5):
┌────────────────────────────────────────┐
│ Chunk 5 (Page 3)  distance: 0.152 ✅  │ ⭐⭐⭐⭐⭐
│ Chunk 8 (Page 4)  distance: 0.223 ✅  │ ⭐⭐⭐⭐
│ Chunk 11 (Page 5) distance: 0.284 ✅  │ ⭐⭐⭐
│ Chunk 14 (Page 6) distance: 0.351 ✅  │ ⭐⭐
│ Chunk 17 (Page 7) distance: 0.412 ✅  │ ⭐⭐
└────────────────────────────────────────┘
Processing time: 100-200ms

STEP 3: Build Context for LLM
┌──────────────────────────────────────────┐
│ [machine_learning_guide.pdf - Page 3]    │
│ "Supervised learning can be divided..." │
│                                          │
│ [machine_learning_guide.pdf - Page 4]    │
│ "Classification is a type of..." │
│                                          │
│ [machine_learning_guide.pdf - Page 5]    │
│ "Regression predicts continuous..." │
│                                          │
│ ... (2 more chunks) ...                 │
│                                          │
│ Use this to answer: "What are the main  │
│ types of supervised learning?"          │
└──────────────────────────────────────────┘

STEP 4: Generate Response
LLM Input:
- Chat history
- User query
- Document chunks + sources

LLM Output:
"The main types of supervised learning are classification
and regression. Classification predicts discrete categories
(e.g., spam/not spam), while regression predicts continuous
values (e.g., house prices)."

Processing time: 5-15 seconds

STEP 5: Format with Sources
┌──────────────────────────────────────────────┐
│ 🤖 **Answer**                                │
│                                              │
│ The main types of supervised learning are..│
│                                              │
│ ---                                         │
│                                              │
│ 📚 **Sources Used:**                        │
│                                              │
│ **Chunk 1** ⭐⭐⭐⭐⭐                         │
│ - Page 3 (Score: 0.152)                    │
│ - "Supervised learning can be divided into"│
│                                              │
│ **Chunk 2** ⭐⭐⭐⭐                         │
│ - Page 4 (Score: 0.223)                    │
│ - "Classification is a type of supervised" │
│                                              │
│ [... 3 more chunks ...]                     │
│                                              │
│ 📄 **Documents:**                           │
│ - **machine_learning_guide.pdf**            │
│   (Pages: 3, 4, 5, 6, 7)                   │
└──────────────────────────────────────────────┘
```

---

## Chunk Similarity Space (2D Visualization)

```
Embedding Space (simplified to 2D for visualization)

                          ▲ Semantic Axis 2 (Topic)
                          │
           Unsupervised    │
           Learning ◆      │         ◆ Neural Networks
           (far from       │        (related)
            supervised)    │
                          │
                          │  ◆ Decision Trees
                          │  (related)
    ─────────────────────┼──────────────────────────►
                         │        Semantic Axis 1 (Concept)
                         │
                    ◆ "Training Data"
                    (foundational, related)
                         │
               ◆ QUERY: "supervised learning?"
               (search point)           │
                         │
        ◆ "Supervised Learning Basics"
        (distance: 0.15 - CLOSEST)     │

DISTANCE INTERPRETATION:
- 0.15: Perfect semantic match (⭐⭐⭐⭐⭐)
- 0.25: Very similar topic (⭐⭐⭐⭐)
- 0.35: Related but different angle (⭐⭐⭐)
- 0.50+: Tangentially related (⭐⭐)
- 1.0+: Different topic

BGE-M3 captures:
✓ Word meanings (semantic)
✓ Phrase relationships (syntax)
✓ Topic clustering (domain)
✓ Cross-language similarity (Korean + English)
```

---

## Chunking Strategy Hierarchy

```
TEXT TO CHUNK: "Machine Learning Fundamentals.
                It's a powerful technology. Modern systems use it."

SPLITTING STRATEGY (Recursive):

Level 1: Try splitting by "\n\n" (paragraphs)
         ↓ No paragraph breaks found

Level 2: Try splitting by "\n" (line breaks)
         ↓ No line breaks found

Level 3: Try splitting by ". " (sentences) ✓
         ├─ CHUNK A: "Machine Learning Fundamentals."
         ├─ CHUNK B: "It's a powerful technology."
         └─ CHUNK C: "Modern systems use it."

Result: Sentences preserved (best semantic units)
        Content split naturally at periods


More complex example:

TEXT: "Title

      Paragraph 1. Sentence 2. Sentence 3.

      Paragraph 2. More text here."

SPLITTING:

Level 1: "\n\n" (paragraph breaks) ✓
         ├─ Para 1: "Title\n\nParagraph 1. Sentence 2..."
         └─ Para 2: "Paragraph 2. More text here."

Level 2: Within Para 1, "\n" (lines) - no breaks, continue

Level 3: Within Para 1, ". " (sentences) ✓
         ├─ "Title"
         ├─ "Paragraph 1."
         ├─ "Sentence 2."
         └─ "Sentence 3."

Level 4: Within each, " " (words) - only if > 1000 chars

Level 5: "" (characters) - only if single word > 1000 chars

BENEFIT: Preserves document structure while keeping chunks
         semantically coherent and appropriately sized.
```

---

## Real-World Chunk Example

```
DOCUMENT TEXT (from ml_guide.pdf, pages 3-4):

"--- Page 3 ---

Types of Supervised Learning

Supervised learning can be categorized into two main types:
classification and regression. Both types require labeled training
data where each example has an associated target output.

Classification is used when the output variable takes on discrete
categorical values. For example, predicting whether an email is spam
or not (binary classification), or classifying images as dogs, cats,
or birds (multi-class classification).

--- Page 4 ---

Regression is used when the output variable is continuous. Examples
include predicting house prices based on features like square footage
and location, or forecasting stock prices."

AFTER CHUNKING (1000 chars, 200 overlap):

╔════════════════════════════════════════════════════════════╗
║ CHUNK 5 (Index 5)                                          ║
║ Source: ml_guide.pdf, Page 3                              ║
║ Size: 987 characters                                       ║
╠════════════════════════════════════════════════════════════╣
║ Supervised learning can be categorized into two main types║
║ classification and regression. Both types require labeled  ║
║ training data where each example has an associated target  ║
║ output.                                                    ║
║                                                            ║
║ Classification is used when the output variable takes on   ║
║ discrete categorical values. For example, predicting       ║
║ whether an email is spam or not (binary classification),   ║
║ or classifying images as dogs, cats, or birds             ║
║ (multi-class classification).                             ║
╚════════════════════════════════════════════════════════════╝
                    └─ OVERLAP ─┘ (200 chars)
                              ╔══════════════════════════════╗
                              ║ CHUNK 8 (Index 8)            ║
                              ║ Source: ml_guide.pdf, Page 4 ║
                              ║ Size: 945 characters         ║
                              ╠══════════════════════════════╣
                              ║ (multi-class classification) ║
                              ║ [← overlap from Chunk 5]    ║
                              ║                              ║
                              ║ Regression is used when the  ║
                              ║ output variable is continuous║
                              ║ Examples include predicting  ║
                              ║ house prices based on        ║
                              ║ features like square footage ║
                              ║ and location, or forecasting ║
                              ║ stock prices.               ║
                              ╚══════════════════════════════╝

Why overlap helps:
- Chunk 5 ends with: "(multi-class classification)"
- Chunk 8 starts with: "(multi-class classification)" [REPEATED]
- Even if query matches only Chunk 8, concept is preserved
- Better coverage of boundary topics
- More relevant results in RAG search
```

---

## Similarity Score Scale

```
┌─────────────────────────────────────────────────────┐
│ Cosine Similarity Score Scale (0.0 - 2.0)          │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 0.0        [IDENTICAL] ✓✓✓✓✓                       │
│ 0.15       [PERFECT]   ⭐⭐⭐⭐⭐                   │
│ 0.25       [EXCELLENT] ⭐⭐⭐⭐                     │
│ 0.35       [VERY GOOD] ⭐⭐⭐                       │
│ 0.45       [GOOD]      ⭐⭐                         │
│ 0.60       [MODERATE]  ⭐                          │
│ 0.80+      [WEAK]      ✗                           │
│ 1.0        [NEUTRAL]   (perpendicular)             │
│ 1.5        [POOR]      ✗✗                          │
│ 2.0        [OPPOSITE]  ✗✗✗ (negation)             │
│                                                      │
├─────────────────────────────────────────────────────┤
│ Typical RAG Results:                                │
│ - Top 1 chunk: 0.12-0.20                           │
│ - Top 2 chunk: 0.20-0.30                           │
│ - Top 3 chunk: 0.30-0.40                           │
│ - Top 4 chunk: 0.40-0.50                           │
│ - Top 5 chunk: 0.50-0.60                           │
└─────────────────────────────────────────────────────┘

Note: Lower is better (0 = perfect match)
```

---

## Summary: From Upload to Answer

```
Timeline for typical 50-page PDF with user question:

0ms    Upload PDF
       ↓
1000ms Extract text (1-2 sec)
       ↓
1500ms Chunk text (0.5-1 sec)
       ↓
3500ms Generate embeddings (2-3 sec)
       ↓
3700ms Store in ChromaDB (100-200ms)
       ↓
       [PDF ready for queries]
       ↓
3750ms User asks question
       ↓
3800ms Embed user query (50ms)
       ↓
4000ms Search ChromaDB, get top 5 chunks (200ms)
       ↓
4100ms Build context with chunks (50ms)
       ↓
4150ms Send to LLM with context
       ↓
19000ms LLM generates answer (5-15 sec)
       ↓
19100ms Format response with sources (50ms)
       ↓
19100ms Display to user

TOTAL:
- First time: ~3.7 seconds to process PDF
- Per query: ~15 seconds (mostly LLM time)
- Subsequent queries: Same ~15 seconds (RAG is fast)
```

