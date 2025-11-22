# 아키텍처 문서 (Architecture Documentation)

이 문서는 Agent Chat UI 프로젝트의 전체 아키텍처와 프론트엔드/백엔드 간의 상호작용을 설명합니다.

## 목차

1. [전체 아키텍처 개요](#전체-아키텍처-개요)
2. [프론트엔드 아키텍처](#프론트엔드-아키텍처)
3. [백엔드 아키텍처](#백엔드-아키텍처)
4. [프론트엔드-백엔드 통신](#프론트엔드-백엔드-통신)
5. [데이터 흐름](#데이터-흐름)
6. [주요 컴포넌트](#주요-컴포넌트)

---

## 전체 아키텍처 개요

Agent Chat UI는 Next.js 기반의 프론트엔드와 LangGraph 기반의 Python 백엔드로 구성된 채팅 인터페이스 애플리케이션입니다.

```mermaid
graph TB
    subgraph "Client (Browser)"
        UI[Next.js Frontend<br/>Port 3000]
        APIProxy[API Passthrough<br/>/api/catch-all]
    end
    
    subgraph "Backend Services"
        LG[LangGraph Server<br/>Port 2024]
        Ollama[Ollama LLM<br/>Port 11434]
        ChromaDB[(ChromaDB<br/>Vector Store)]
    end
    
    UI -->|HTTP/SSE| APIProxy
    APIProxy -->|HTTP/SSE<br/>+ API Key| LG
    LG -->|LLM Requests| Ollama
    LG -->|Store/Query| ChromaDB
    
    style UI fill:#3b82f6,color:#fff
    style LG fill:#10b981,color:#fff
    style Ollama fill:#f59e0b,color:#fff
    style ChromaDB fill:#8b5cf6,color:#fff
```

---

## 프론트엔드 아키텍처

### 구조 개요

프론트엔드는 Next.js 14+ (App Router)를 사용하며, React Context API를 통해 전역 상태를 관리합니다.

```mermaid
graph LR
    subgraph "Next.js App"
        Page[page.tsx<br/>메인 페이지]
        Layout[layout.tsx<br/>루트 레이아웃]
        APIRoute[api catch-all route.ts<br/>API 프록시]
    end
    
    subgraph "Providers"
        StreamProvider[StreamProvider<br/>LangGraph 연결 관리]
        ThreadProvider[ThreadProvider<br/>스레드 목록 관리]
    end
    
    subgraph "Components"
        Thread[Thread Component<br/>채팅 인터페이스]
        Messages[Message Components<br/>AI/Human/Tool]
        Inbox[Agent Inbox<br/>HITL 인터럽트]
    end
    
    Page --> Layout
    Layout --> StreamProvider
    Layout --> ThreadProvider
    StreamProvider --> Thread
    ThreadProvider --> Thread
    Thread --> Messages
    Thread --> Inbox
    APIRoute -->|프록시| StreamProvider
    
    style StreamProvider fill:#3b82f6,color:#fff
    style ThreadProvider fill:#10b981,color:#fff
    style Thread fill:#f59e0b,color:#fff
```

### 핵심 Provider 구조

```mermaid
sequenceDiagram
    participant User
    participant StreamProvider
    participant useStream
    participant LangGraph
    
    User->>StreamProvider: 앱 접속
    StreamProvider->>StreamProvider: 환경변수 확인<br/>(NEXT_PUBLIC_API_URL,<br/>NEXT_PUBLIC_ASSISTANT_ID)
    
    alt 환경변수 없음
        StreamProvider->>User: 설정 폼 표시
        User->>StreamProvider: API URL, Assistant ID 입력
    end
    
    StreamProvider->>useStream: useTypedStream 호출
    useStream->>LangGraph: WebSocket/SSE 연결
    LangGraph-->>useStream: 스트리밍 메시지
    useStream-->>StreamProvider: 상태 업데이트
    StreamProvider-->>User: UI 업데이트
```

---

## 백엔드 아키텍처

### LangGraph 워크플로우

백엔드는 LangGraph를 사용하여 상태 기반 워크플로우를 구성합니다.

```mermaid
graph TD
    START([START]) --> Route{route_message<br/>메시지 타입 확인}
    
    Route -->|PDF 파일 포함| ProcessPDF[process_pdf_node<br/>PDF 처리]
    Route -->|일반 텍스트| Chat[chat_node<br/>채팅 처리]
    
    subgraph "PDF 처리 프로세스"
        ProcessPDF --> Extract[PDF 텍스트 추출]
        Extract --> Chunk[텍스트 청킹<br/>1000 chars, 200 overlap]
        Chunk --> Embed[임베딩 생성<br/>BGE-M3]
        Embed --> Store[ChromaDB 저장]
        Store --> Response[응답 메시지 생성]
    end
    
    subgraph "채팅 처리 프로세스"
        Chat --> ExtractText[텍스트 추출]
        ExtractText --> LLM[Ollama LLM 호출]
        LLM --> Response2[AI 응답 생성]
    end
    
    Response --> END([END])
    Response2 --> END
    
    style ProcessPDF fill:#8b5cf6,color:#fff
    style Chat fill:#10b981,color:#fff
    style START fill:#3b82f6,color:#fff
    style END fill:#ef4444,color:#fff
```

### 상태 관리

```mermaid
classDiagram
    class AgentState {
        +Sequence[BaseMessage] messages
    }
    
    class BaseMessage {
        <<abstract>>
        +str id
        +str content
        +str type
    }
    
    class HumanMessage {
        +str content
        +list content_blocks
    }
    
    class AIMessage {
        +str content
    }
    
    AgentState "1" *-- "*" BaseMessage
    BaseMessage <|-- HumanMessage
    BaseMessage <|-- AIMessage
```

---

## 프론트엔드-백엔드 통신

### 통신 방식

프론트엔드와 백엔드는 **하이브리드 통신 방식**을 사용합니다:

#### 통신 프로토콜

1. **REST API**: 초기 요청 및 일부 작업
   - 스레드 목록 조회: `GET /threads/search`
   - 그래프 상태 확인: `GET /info`
   - 스레드 실행 시작: `POST /threads/{threadId}/runs`

2. **SSE (Server-Sent Events)**: 실시간 메시지 스트리밍
   - `useStream` 훅이 SSE를 통해 실시간으로 메시지 업데이트를 수신
   - 메시지가 생성되는 대로 스트리밍으로 전달
   - WebSocket이 아닌 SSE를 사용 (단방향 스트리밍)

#### 환경별 연결 방식

1. **개발 환경**: 클라이언트에서 LangGraph 서버로 직접 SSE 연결
2. **프로덕션 환경**: API Passthrough를 통한 프록시 연결 (SSE도 프록시됨)

```mermaid
graph TB
    subgraph "개발 환경 (Development)"
        DevUI[Next.js Dev<br/>localhost:3000]
        DevLG[LangGraph Dev<br/>localhost:2024]
        DevUI -->|REST API<br/>POST /runs| DevLG
        DevLG -->|SSE 스트림| DevUI
    end
    
    subgraph "프로덕션 환경 (Production)"
        ProdUI[Next.js Prod<br/>my-website.com]
        APIProxy[API Passthrough<br/>/api/catch-all]
        ProdLG[LangGraph Cloud<br/>my-agent.langgraph.app]
        
        ProdUI -->|REST API 요청| APIProxy
        APIProxy -->|REST API<br/>+ API Key 주입| ProdLG
        ProdLG -->|SSE 스트림| APIProxy
        APIProxy -->|SSE 프록시| ProdUI
    end
    
    style DevUI fill:#3b82f6,color:#fff
    style DevLG fill:#10b981,color:#fff
    style ProdUI fill:#3b82f6,color:#fff
    style APIProxy fill:#f59e0b,color:#fff
    style ProdLG fill:#10b981,color:#fff
```

### 메시지 스트리밍 흐름

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant APIProxy
    participant LangGraph
    participant Ollama
    
    User->>Frontend: 메시지 입력
    Frontend->>APIProxy: POST /threads/{threadId}/runs
    APIProxy->>LangGraph: POST /threads/{threadId}/runs<br/>(API Key 주입)
    
    LangGraph->>LangGraph: route_message 실행
    alt PDF 파일인 경우
        LangGraph->>LangGraph: PDF 처리<br/>(추출, 청킹, 임베딩)
        LangGraph->>ChromaDB: 벡터 저장
    else 일반 텍스트인 경우
        LangGraph->>Ollama: LLM 호출
        Ollama-->>LangGraph: 스트리밍 응답
    end
    
    LangGraph-->>APIProxy: SSE 스트림<br/>(messages 업데이트)
    APIProxy-->>Frontend: SSE 스트림 프록시
    Frontend-->>User: 실시간 메시지 표시
```

---

## 데이터 흐름

### 전체 데이터 흐름도

```mermaid
flowchart TD
    Start([사용자 메시지 입력]) --> Upload{파일 업로드?}
    
    Upload -->|Yes| Convert[파일 변환<br/>multimodal-utils.ts]
    Upload -->|No| Direct[직접 텍스트]
    
    Convert --> Format[메시지 포맷팅<br/>HumanMessage]
    Direct --> Format
    
    Format --> Stream[StreamProvider<br/>useTypedStream]
    Stream --> Send[LangGraph API<br/>POST /runs]
    
    Send --> Backend[백엔드 처리]
    
    Backend --> Route{라우팅<br/>route_message}
    
    Route -->|PDF| PDFProcess[PDF 처리 노드]
    Route -->|Text| ChatProcess[채팅 노드]
    
    PDFProcess --> PDFExtract[텍스트 추출]
    PDFExtract --> PDFChunk[청킹]
    PDFChunk --> PDFEmbed[임베딩]
    PDFEmbed --> PDFStore[(ChromaDB 저장)]
    PDFStore --> PDFResponse[응답 생성]
    
    ChatProcess --> ChatExtract[텍스트 추출]
    ChatExtract --> ChatLLM[Ollama 호출]
    ChatLLM --> ChatResponse[AI 응답]
    
    PDFResponse --> StreamBack[SSE 스트림]
    ChatResponse --> StreamBack
    
    StreamBack --> Update[상태 업데이트<br/>StreamProvider]
    Update --> Render[UI 렌더링<br/>Thread Component]
    Render --> Display[사용자에게 표시]
    
    style Start fill:#3b82f6,color:#fff
    style Backend fill:#10b981,color:#fff
    style PDFStore fill:#8b5cf6,color:#fff
    style Display fill:#f59e0b,color:#fff
```

### PDF 처리 상세 흐름

```mermaid
flowchart LR
    A[PDF 업로드] --> B[Base64 디코딩]
    B --> C[PyPDF로 텍스트 추출]
    C --> D[페이지별 텍스트]
    D --> E[텍스트 청킹<br/>1000 chars, 200 overlap]
    E --> F[BGE-M3 임베딩]
    F --> G[ChromaDB 저장]
    G --> H[처리 완료 메시지]
    
    style A fill:#3b82f6,color:#fff
    style G fill:#8b5cf6,color:#fff
    style H fill:#10b981,color:#fff
```

---

## 주요 컴포넌트

### 프론트엔드 컴포넌트 계층

```mermaid
graph TD
    App[app/layout.tsx] --> StreamProvider
    App --> ThreadProvider
    
    StreamProvider --> Thread[components/thread/index.tsx]
    ThreadProvider --> Thread
    
    Thread --> Messages[components/thread/messages/]
    Thread --> Inbox[components/thread/agent-inbox/]
    Thread --> History[components/thread/history/]
    Thread --> Artifact[components/thread/artifact.tsx]
    
    Messages --> AI[ai.tsx<br/>AI 메시지]
    Messages --> Human[human.tsx<br/>사용자 메시지]
    Messages --> ToolCalls[tool-calls.tsx<br/>도구 호출]
    
    Inbox --> InboxInput[inbox-item-input.tsx]
    Inbox --> StateView[state-view.tsx]
    Inbox --> ThreadActions[thread-actions-view.tsx]
    
    style StreamProvider fill:#3b82f6,color:#fff
    style ThreadProvider fill:#10b981,color:#fff
    style Thread fill:#f59e0b,color:#fff
```

### 백엔드 모듈 구조

```mermaid
graph TD
    Graph[graph.py<br/>워크플로우 정의] --> Nodes[nodes.py<br/>노드 로직]
    Graph --> State[state.py<br/>상태 정의]
    
    Nodes --> Route[route_message<br/>라우팅 함수]
    Nodes --> ProcessPDF[process_pdf_node<br/>PDF 처리]
    Nodes --> Chat[chat_node<br/>채팅 처리]
    
    ProcessPDF --> PDFProcessor[pdf_processor.py<br/>PDF 처리 로직]
    PDFProcessor --> Embedding[embedding_service.py<br/>임베딩 생성]
    PDFProcessor --> VectorStore[vector_store.py<br/>ChromaDB 관리]
    
    Chat --> Ollama[ChatOllama<br/>LLM 호출]
    
    style Graph fill:#3b82f6,color:#fff
    style Nodes fill:#10b981,color:#fff
    style PDFProcessor fill:#8b5cf6,color:#fff
```

---

## 환경 변수 설정

### 개발 환경

```mermaid
graph LR
    A[.env.local] --> B[NEXT_PUBLIC_API_URL<br/>http://localhost:2024]
    A --> C[NEXT_PUBLIC_ASSISTANT_ID<br/>agent]
    
    D[backend/.env] --> E[OLLAMA_MODEL<br/>gemma3:12b]
    D --> F[OLLAMA_BASE_URL<br/>http://localhost:11434]
    
    style A fill:#3b82f6,color:#fff
    style D fill:#10b981,color:#fff
```

### 프로덕션 환경

```mermaid
graph TB
    A[환경 변수] --> B[NEXT_PUBLIC_API_URL<br/>https://my-website.com/api]
    A --> C[NEXT_PUBLIC_ASSISTANT_ID<br/>agent]
    A --> D[LANGGRAPH_API_URL<br/>https://my-agent.langgraph.app]
    A --> E[LANGSMITH_API_KEY<br/>lsv2_...]
    
    B --> F[클라이언트에서 사용]
    C --> F
    D --> G[서버 사이드 프록시]
    E --> G
    
    style F fill:#3b82f6,color:#fff
    style G fill:#f59e0b,color:#fff
```

---

## 스레드 관리

### 스레드 생명주기

```mermaid
stateDiagram-v2
    [*] --> New: 사용자 메시지 입력
    New --> Creating: StreamProvider 호출
    Creating --> Active: Thread ID 생성
    Active --> Streaming: 메시지 스트리밍
    Streaming --> Active: 스트리밍 완료
    Active --> Archived: 스레드 목록에 저장
    Archived --> Active: 기존 스레드 선택
    Active --> [*]: 스레드 삭제
```

### 스레드 검색 메커니즘

```mermaid
flowchart TD
    Start[ThreadProvider.getThreads] --> Check{assistantId<br/>UUID 형식?}
    
    Check -->|Yes| UUID[assistant_id로 검색]
    Check -->|No| GraphID[graph_id로 검색]
    
    UUID --> Search[LangGraph API<br/>threads.search]
    GraphID --> Search
    
    Search --> Return[스레드 목록 반환]
    Return --> Update[UI 업데이트]
    
    style Start fill:#3b82f6,color:#fff
    style Search fill:#10b981,color:#fff
    style Update fill:#f59e0b,color:#fff
```

---

## HITL (Human-in-the-Loop) 인터럽트

### 인터럽트 처리 흐름

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant LangGraph
    participant Inbox
    
    LangGraph->>Frontend: 인터럽트 이벤트<br/>(action_requests)
    Frontend->>Inbox: Agent Inbox 표시
    Inbox->>User: 승인/수정/거부 요청
    
    User->>Inbox: 결정 입력
    Inbox->>LangGraph: POST /threads/{id}/runs<br/>(decision 포함)
    LangGraph->>LangGraph: 인터럽트 해결
    LangGraph->>Frontend: 계속 실행
    Frontend->>User: 결과 표시
```

---

## 요약

### 핵심 아키텍처 특징

1. **프론트엔드**: Next.js + React Context API로 상태 관리
2. **백엔드**: LangGraph로 상태 기반 워크플로우 구성
3. **통신**: WebSocket/SSE를 통한 실시간 스트리밍
4. **프로덕션**: API Passthrough를 통한 보안 프록시
5. **PDF 처리**: 자동 라우팅 및 벡터 저장
6. **HITL**: 인간 개입을 위한 인터럽트 시스템

### 기술 스택

- **프론트엔드**: Next.js 14+, React, TypeScript, Tailwind CSS
- **백엔드**: Python 3.11+, LangGraph, LangChain, Ollama
- **데이터베이스**: ChromaDB (벡터 저장소)
- **LLM**: Ollama (로컬 모델)

---

## 주요 코드 스니펫

### 프론트엔드 핵심 코드

#### StreamProvider - LangGraph 연결 관리

```82:102:src/providers/Stream.tsx
  const streamValue = useTypedStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,
    fetchStateHistory: true,
    onCustomEvent: (event, options) => {
      if (isUIMessage(event) || isRemoveUIMessage(event)) {
        options.mutate((prev) => {
          const ui = uiMessageReducer(prev.ui ?? [], event);
          return { ...prev, ui };
        });
      }
    },
    onThreadId: (id) => {
      setThreadId(id);
      // Refetch threads list when thread ID changes.
      // Wait for some seconds before fetching so we're able to get the new thread that was created.
      sleep().then(() => getThreads().then(setThreads).catch(console.error));
    },
  });
```

#### API Passthrough 설정

```6:11:src/app/api/[..._path]/route.ts
export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: process.env.LANGGRAPH_API_URL ?? "remove-me", // default, if not defined it will attempt to read process.env.LANGGRAPH_API_URL
    apiKey: process.env.LANGSMITH_API_KEY ?? "remove-me", // default, if not defined it will attempt to read process.env.LANGSMITH_API_KEY
    runtime: "edge", // default
  });
```

### 백엔드 핵심 코드

#### LangGraph 워크플로우 정의

```6:28:backend/src/agent/graph.py
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
```

#### 메시지 라우팅 로직

```52:65:backend/src/agent/nodes.py
def route_message(state: AgentState) -> str:
    """Determine which node to route to based on the message."""
    last_message = state["messages"][-1]

    if isinstance(last_message, HumanMessage):
        content = last_message.content
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get('type') == 'image_url':
                    url = _extract_url_from_item(item)
                    if _is_pdf_url(url):
                        return "process_pdf"

    return "chat"
```

#### 상태 정의

```11:13:backend/src/agent/state.py
class AgentState(TypedDict):
    """Simple agent state with only messages."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
```

#### 스레드 검색 메커니즘

```26:34:src/providers/Thread.tsx
function getThreadSearchMetadata(
  assistantId: string,
): { graph_id: string } | { assistant_id: string } {
  if (validate(assistantId)) {
    return { assistant_id: assistantId };
  } else {
    return { graph_id: assistantId };
  }
}
```

### 주요 패턴

#### 1. 환경 변수 우선순위

프론트엔드에서는 URL 쿼리 파라미터 > 환경 변수 순으로 우선순위를 가집니다:

```141:162:src/providers/Stream.tsx
  // Use URL params with env var fallbacks
  const [apiUrl, setApiUrl] = useQueryState("apiUrl", {
    defaultValue: envApiUrl || "",
  });
  const [assistantId, setAssistantId] = useQueryState("assistantId", {
    defaultValue: envAssistantId || "",
  });

  // For API key, use localStorage with env var fallback
  const [apiKey, _setApiKey] = useState(() => {
    const storedKey = getApiKey();
    return storedKey || "";
  });

  const setApiKey = (key: string) => {
    window.localStorage.setItem("lg:chat:apiKey", key);
    _setApiKey(key);
  };

  // Determine final values to use, prioritizing URL params then env vars
  const finalApiUrl = apiUrl || envApiUrl;
  const finalAssistantId = assistantId || envAssistantId;
```

#### 2. PDF 처리 흐름

PDF 파일이 감지되면 자동으로 PDF 처리 노드로 라우팅됩니다:

```85:105:backend/src/agent/nodes.py
def process_pdf_node(state: AgentState) -> AgentState:
    """Process uploaded PDF and return results."""
    last_message = state["messages"][-1]

    try:
        content = last_message.content
        pdf_result = None

        if isinstance(content, list):
            pdf_result = _extract_pdf_from_message(content)

        if not pdf_result:
            state["messages"].append(
                AIMessage(content="❌ **PDF Processing Error**\n\nNo PDF file found in the message.")
            )
            return state

        pdf_data, filename = pdf_result

        # Process PDF
        result = pdf_processor.process_pdf(pdf_data, filename)
```

#### 3. 스트리밍 메시지 처리

실시간 스트리밍 메시지는 `onCustomEvent` 콜백을 통해 처리됩니다:

```88:95:src/providers/Stream.tsx
    onCustomEvent: (event, options) => {
      if (isUIMessage(event) || isRemoveUIMessage(event)) {
        options.mutate((prev) => {
          const ui = uiMessageReducer(prev.ui ?? [], event);
          return { ...prev, ui };
        });
      }
    },
```

