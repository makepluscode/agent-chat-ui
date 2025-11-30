import { useState, useRef, ChangeEvent, useEffect, useCallback } from "react";
import { useStreamContext } from "@/providers/Stream";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Upload, LoaderCircle } from "lucide-react";
import { fileToContentBlock } from "@/lib/multimodal-utils";
import { Message } from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { useRAGSources } from "@/providers/RAGSources";
import { RAGSourceMetadata } from "@/types/rag-source";
import { SourceInfoDialog } from "./source-info-dialog";
import { getContentString } from "../thread/utils";

interface SourceAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 백엔드 응답에서 메타데이터 파싱
function parsePDFMetadata(responseText: string): RAGSourceMetadata | null {
  try {
    // 마크다운 형식의 응답에서 정보 추출 (더 유연한 패턴)
    const totalPagesMatch = responseText.match(/\*\*Total Pages\*\*[:\s]*(\d+)/i) ||
                           responseText.match(/Total Pages[:\s]*(\d+)/i);
    const totalCharsMatch = responseText.match(/\*\*Total Characters\*\*[:\s]*([\d,]+)/i) ||
                           responseText.match(/Total Characters[:\s]*([\d,]+)/i);
    const chunkCountMatch = responseText.match(/\*\*Chunks Created\*\*[:\s]*(\d+)/i) ||
                            responseText.match(/Chunks Created[:\s]*(\d+)/i);
    const avgChunkSizeMatch = responseText.match(/\*\*Average Chunk Size\*\*[:\s]*(\d+)/i) ||
                              responseText.match(/Average Chunk Size[:\s]*(\d+)/i);
    const embeddingModelMatch = responseText.match(/\*\*Embedding Model\*\*[:\s]*([^\n]+)/i) ||
                                responseText.match(/Embedding Model[:\s]*([^\n]+)/i);
    const embeddingsGeneratedMatch = responseText.match(/\*\*Embeddings Generated\*\*[:\s]*(\d+)/i) ||
                                    responseText.match(/Embeddings Generated[:\s]*(\d+)/i);

    if (!totalPagesMatch || !totalCharsMatch || !chunkCountMatch) {
      console.error("Missing required fields:", {
        totalPages: !!totalPagesMatch,
        totalChars: !!totalCharsMatch,
        chunkCount: !!chunkCountMatch,
      });
      return null;
    }

    // 페이지 텍스트 추출
    const pageTexts: Array<{ page: number; text: string; charCount: number }> = [];
    // 백엔드 형식: **Page {num}** ({count} characters)\n{text}...
    const pagePattern = /\*\*Page (\d+)\*\* \(([\d,]+) characters\)\n([^\n]+(?:\.\.\.)?)/g;
    let pageMatch;
    while ((pageMatch = pagePattern.exec(responseText)) !== null) {
      const pageNum = parseInt(pageMatch[1], 10);
      const charCount = parseInt(pageMatch[2].replace(/,/g, ""), 10);
      let text = pageMatch[3].trim();
      // "..." 제거
      if (text.endsWith("...")) {
        text = text.slice(0, -3).trim();
      }
      
      if (text) {
        pageTexts.push({
          page: pageNum,
          text: text,
          charCount: charCount,
        });
      }
    }

    const metadata: RAGSourceMetadata = {
      totalPages: parseInt(totalPagesMatch[1], 10),
      totalChars: parseInt(totalCharsMatch[1].replace(/,/g, ""), 10),
      chunkCount: parseInt(chunkCountMatch[1], 10),
      avgChunkSize: avgChunkSizeMatch
        ? parseInt(avgChunkSizeMatch[1], 10)
        : 0,
      embeddingModel: embeddingModelMatch
        ? embeddingModelMatch[1].trim().replace(/\*\*/g, "")
        : "BAAI/bge-m3",
      embeddingsGenerated: embeddingsGeneratedMatch
        ? parseInt(embeddingsGeneratedMatch[1], 10)
        : 0,
      pageTexts: pageTexts.length > 0 ? pageTexts : undefined,
    };

    return metadata;
  } catch (error) {
    console.error("Failed to parse PDF metadata:", error);
    return null;
  }
}

export function SourceAddDialog({
  open,
  onOpenChange,
}: SourceAddDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [processedMetadata, setProcessedMetadata] =
    useState<RAGSourceMetadata | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stream = useStreamContext();
  const { addSource, updateSourceMetadata } = useRAGSources();
  
  // useRef로 처리 상태 추적 (클로저 문제 방지)
  const processingRef = useRef(false);
  const pendingFileRef = useRef<File | null>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const lastMessageLengthRef = useRef(0);
  const messageStableTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addSourceRef = useRef(addSource);
  const updateSourceMetadataRef = useRef(updateSourceMetadata);
  const onOpenChangeRef = useRef(onOpenChange);
  
  // ref 업데이트
  useEffect(() => {
    addSourceRef.current = addSource;
    updateSourceMetadataRef.current = updateSourceMetadata;
    onOpenChangeRef.current = onOpenChange;
  }, [addSource, updateSourceMetadata, onOpenChange]);

  // 다이얼로그가 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      // 다이얼로그가 닫힐 때 상태 초기화
      setSelectedFile(null);
      setIsProcessing(false);
      setShowInfoDialog(false);
      setProcessedMetadata(null);
      setPendingFilename("");
      processingRef.current = false;
      pendingFileRef.current = null;
      processedMessageIdsRef.current.clear();
    }
  }, [open]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("PDF 파일만 업로드할 수 있습니다.");
      return;
    }

    setSelectedFile(file);
  };

  // 응답 감지 - 메시지가 추가되고 스트리밍이 완료된 후 처리
  useEffect(() => {
    // 처리 중이 아니거나 대기 중인 파일이 없으면 무시
    if (!processingRef.current || !pendingFileRef.current) {
      return;
    }

    const messages = stream.messages;
    if (messages.length === 0) {
      return;
    }

    // 가장 최근 AI 메시지 찾기
    const aiMessages = messages.filter(m => m.type === "ai");
    if (aiMessages.length === 0) {
      return;
    }

    const lastAIMessage = aiMessages[aiMessages.length - 1];
    const messageId = lastAIMessage.id || "";
    
    // 이미 처리한 메시지인지 확인
    if (messageId && processedMessageIdsRef.current.has(messageId)) {
      return;
    }

    const responseText = getContentString(lastAIMessage.content);

    // 스트리밍이 완료되지 않았으면 대기
    if (stream.isLoading) {
      return;
    }

    // 메시지 길이가 변하고 있으면 대기 (스트리밍 중일 수 있음)
    const currentMessageLength = responseText.length;
    if (currentMessageLength !== lastMessageLengthRef.current) {
      lastMessageLengthRef.current = currentMessageLength;
      
      // 기존 타임아웃 클리어
      if (messageStableTimeoutRef.current) {
        clearTimeout(messageStableTimeoutRef.current);
      }
      
      // 메시지가 안정화될 때까지 대기 (1초)
      messageStableTimeoutRef.current = setTimeout(() => {
        checkAndProcessPDFResponse(lastAIMessage, responseText);
      }, 1000);
      
      return;
    }

    // 메시지가 안정화되었으면 즉시 처리
    if (messageStableTimeoutRef.current) {
      clearTimeout(messageStableTimeoutRef.current);
      messageStableTimeoutRef.current = null;
    }
    
    checkAndProcessPDFResponse(lastAIMessage, responseText);

    // 클린업 함수
    return () => {
      if (messageStableTimeoutRef.current) {
        clearTimeout(messageStableTimeoutRef.current);
      }
    };
  }, [stream.messages, stream.isLoading]);

  // PDF 응답 확인 및 처리 함수
  const checkAndProcessPDFResponse = (lastAIMessage: Message, responseText: string) => {
    if (!processingRef.current || !pendingFileRef.current) {
      return;
    }

    const messageId = lastAIMessage.id || "";
    
    // 이미 처리한 메시지인지 확인
    if (messageId && processedMessageIdsRef.current.has(messageId)) {
      return;
    }

    // PDF 처리 완료 메시지인지 확인
    const isPDFResponse = 
        responseText.includes("PDF Parsing and Embedding Complete") || 
        responseText.includes("✅") ||
        (responseText.includes("PDF Parsing") && responseText.includes("Complete")) ||
        (responseText.includes("Embedding") && responseText.includes("Complete")) ||
        (responseText.includes("Chunks Created") && responseText.includes("Total Pages")) ||
        (responseText.includes("Total Pages") && responseText.includes("Chunks Created"));

    if (isPDFResponse) {
      
      // 메시지 처리 표시
      if (messageId) {
        processedMessageIdsRef.current.add(messageId);
      }

      // 메타데이터 파싱
      const metadata = parsePDFMetadata(responseText);
      const currentPendingFile = pendingFileRef.current;
      
      console.log("[SourceAddDialog] Metadata parsing result:", {
        metadata: metadata ? "success" : "failed",
        hasPendingFile: !!currentPendingFile,
        filename: currentPendingFile?.name
      });
      
      if (metadata && currentPendingFile) {
        try {
          // 파일 정보 저장 (ref 사용)
          if (!addSourceRef.current) {
            throw new Error("addSource function not available");
          }
          
          const sourceId = addSourceRef.current(currentPendingFile, metadata);
          
          if (!updateSourceMetadataRef.current) {
            throw new Error("updateSourceMetadata function not available");
          }
          
          updateSourceMetadataRef.current(sourceId, metadata);
          
          // 상태 업데이트
          setProcessedMetadata(metadata);
          processingRef.current = false;
          setIsProcessing(false);
          
          // 업로드 다이얼로그 닫기 (ref 사용)
          if (onOpenChangeRef.current) {
            onOpenChangeRef.current(false);
          }
          
          // 약간의 지연 후 정보 다이얼로그 열기
          setTimeout(() => {
            setShowInfoDialog(true);
            toast.success("PDF 파일이 성공적으로 추가되었습니다.");
          }, 200);
          
          // 정리
          setSelectedFile(null);
          pendingFileRef.current = null;
          lastMessageLengthRef.current = 0;
        } catch (error) {
          console.error("Error processing PDF:", error);
          toast.error(`파일 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
          processingRef.current = false;
          setIsProcessing(false);
          pendingFileRef.current = null;
        }
      } else {
        console.error("Failed to parse metadata", {
          metadata,
          pendingFile: currentPendingFile,
        });
        toast.error("파일 정보를 파싱할 수 없습니다.");
        processingRef.current = false;
        setIsProcessing(false);
        pendingFileRef.current = null;
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // 처리 상태 설정
    processingRef.current = true;
    pendingFileRef.current = selectedFile;
    setIsProcessing(true);
    setPendingFilename(selectedFile.name);

    try {
      // PDF를 ContentBlock으로 변환
      const contentBlock = await fileToContentBlock(selectedFile);

      // 메시지 생성
      const message: Message = {
        id: uuidv4(),
        type: "human",
        content: [contentBlock] as Message["content"],
      };

      // 백엔드로 전송
      const toolMessages = stream.messages.filter(
        (m) => m.type === "tool" || m.type === "tool_call"
      );

      stream.submit(
        { messages: [...toolMessages, message] },
        {
          streamMode: ["values"],
          streamSubgraphs: true,
          streamResumable: true,
        }
      );

      // 타임아웃 설정 (30초)
      setTimeout(() => {
        if (processingRef.current && pendingFileRef.current) {
          console.error("Timeout! Processing took too long");
          processingRef.current = false;
          setIsProcessing(false);
          pendingFileRef.current = null;
          toast.error("파일 처리 시간이 초과되었습니다.");
        }
      }, 30000);
    } catch (error) {
      console.error("Failed to upload PDF:", error);
      toast.error("PDF 업로드 중 오류가 발생했습니다.");
      processingRef.current = false;
      setIsProcessing(false);
      pendingFileRef.current = null;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
    } else {
      toast.error("PDF 파일만 업로드할 수 있습니다.");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PDF 파일 선택</DialogTitle>
            <DialogDescription>
              RAG를 위한 PDF 파일을 선택하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 드래그 앤 드롭 영역 */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-2">
                파일을 드래그하여 놓기
              </p>
              <p className="text-xs text-gray-500">또는 클릭하여 선택</p>
              <p className="text-xs text-gray-400 mt-2">지원 형식: PDF만</p>
            </div>

            {/* 파일 선택 입력 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* 선택된 파일 표시 */}
            {selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-gray-600" />
                <span className="flex-1 text-sm text-gray-700 truncate">
                  {selectedFile.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  제거
                </Button>
              </div>
            )}

            {/* 업로드 버튼 */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                취소
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  "업로드"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 파일 정보 다이얼로그 */}
      {showInfoDialog && processedMetadata && (
        <SourceInfoDialog
          open={showInfoDialog}
          onOpenChange={setShowInfoDialog}
          filename={pendingFilename || "unknown.pdf"}
          metadata={processedMetadata}
        />
      )}
    </>
  );
}

