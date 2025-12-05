import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Search, FileText } from "lucide-react";
import { useRAGSources } from "@/providers/RAGSources";
import { SourceInfoDialog } from "./source-info-dialog";
import { useState } from "react";
import { RAGSource } from "@/types/rag-source";
import { useQueryState } from "nuqs";
import { useStreamContext } from "@/providers/Stream";
import { Message } from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";

export function SourceList() {
  const { sources, toggleSourceActive } = useRAGSources();
  const [selectedSource, setSelectedSource] = useState<RAGSource | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [threadId, setThreadId] = useQueryState("threadId");
  const stream = useStreamContext();

  const handleInfoClick = (source: RAGSource) => {
    setSelectedSource(source);
    setShowInfoDialog(true);
  };

  const handleToggle = (sourceId: string) => {
    // 현재 상태 확인 (체크에서 언체크로 변경되는지 확인)
    const source = sources.find(s => s.id === sourceId);
    const wasActive = source?.isActive ?? false;
    
    toggleSourceActive(sourceId);
    
    // 체크에서 언체크로 변경될 때만 대화 초기화
    if (wasActive && threadId) {
      // DB 초기화 메시지 전송
      const clearMessage: Message = {
        id: uuidv4(),
        type: "human",
        content: "__CLEAR_DB__",
      };
      stream.submit(
        { messages: [clearMessage] },
        { streamMode: ["values"] },
      );
      // 대화 초기화
      setThreadId(null);
    }
  };

  if (sources.length === 0) {
    return null;
  }

  return (
    <>
      <div className="w-full px-4 pt-2 space-y-2">
        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={source.isActive}
              onCheckedChange={() => handleToggle(source.id)}
              id={`source-${source.id}`}
              onClick={(e) => e.stopPropagation()}
            />
            <label
              htmlFor={`source-${source.id}`}
              className="flex-1 flex items-center gap-2 cursor-pointer min-w-0"
              onClick={(e) => e.stopPropagation()}
            >
              <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-700 truncate">
                {source.filename}
              </span>
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleInfoClick(source)}
            >
              <Search className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        ))}
      </div>

      {/* 파일 정보 다이얼로그 */}
      {selectedSource && selectedSource.metadata && (
        <SourceInfoDialog
          open={showInfoDialog}
          onOpenChange={setShowInfoDialog}
          filename={selectedSource.filename}
          metadata={selectedSource.metadata}
        />
      )}
    </>
  );
}

