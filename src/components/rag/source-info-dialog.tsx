import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RAGSourceMetadata } from "@/types/rag-source";
import { Card } from "@/components/ui/card";
import { FileText, Database, Layers } from "lucide-react";

interface SourceInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  metadata: RAGSourceMetadata;
}

export function SourceInfoDialog({
  open,
  onOpenChange,
  filename,
  metadata,
}: SourceInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[960px] h-[540px] max-w-[90vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>파일 정보</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* 좌측: 정보 카드들 */}
          <div className="w-[40%] flex flex-col gap-4 overflow-y-auto pr-2">
            {/* 파일 정보 카드 */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-sm">파일 정보</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">파일명:</span>
                  <span className="ml-2 font-medium">{filename}</span>
                </div>
                <div>
                  <span className="text-gray-600">페이지 수:</span>
                  <span className="ml-2 font-medium">
                    {metadata.totalPages} 페이지
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">총 문자 수:</span>
                  <span className="ml-2 font-medium">
                    {metadata.totalChars.toLocaleString()} 문자
                  </span>
                </div>
              </div>
            </Card>

            {/* 청킹 정보 카드 */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-sm">청킹 정보</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">청크 수:</span>
                  <span className="ml-2 font-medium">
                    {metadata.chunkCount} 청크
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">평균 크기:</span>
                  <span className="ml-2 font-medium">
                    {metadata.avgChunkSize.toLocaleString()} 문자
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">설정:</span>
                  <span className="ml-2 font-medium">1000/200</span>
                </div>
              </div>
            </Card>

            {/* 임베딩 정보 카드 */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-sm">임베딩 정보</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">모델:</span>
                  <span className="ml-2 font-medium">
                    {metadata.embeddingModel}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">생성 수:</span>
                  <span className="ml-2 font-medium">
                    {metadata.embeddingsGenerated} 개
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">차원:</span>
                  <span className="ml-2 font-medium">1024</span>
                </div>
              </div>
            </Card>
          </div>

          {/* 우측: 페이지 미리보기 */}
          <div className="w-[60%] overflow-y-auto">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              페이지 미리보기
            </h3>
            <div className="space-y-4">
              {metadata.pageTexts && metadata.pageTexts.length > 0 ? (
                metadata.pageTexts.slice(0, 3).map((pageData) => (
                  <Card key={pageData.page} className="p-4">
                    <div className="mb-2">
                      <span className="font-semibold text-sm">
                        Page {pageData.page}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({pageData.charCount.toLocaleString()} 문자)
                      </span>
                    </div>
                    <div className="border-t pt-2">
                      <p className="text-sm text-gray-700 line-clamp-4">
                        {pageData.text.substring(0, 200).replace(/\n/g, " ")}
                        {pageData.text.length > 200 ? "..." : ""}
                      </p>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  페이지 미리보기 정보가 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

