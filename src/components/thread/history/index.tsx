import { Button } from "@/components/ui/button";
import { useThreads } from "@/providers/Thread";
import { Thread } from "@langchain/langgraph-sdk";
import { useEffect, useState } from "react";

import { getContentString } from "../utils";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PanelRightOpen, PanelRightClose, FileText, AlertCircle } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SourceAddDialog } from "@/components/rag/source-add-dialog";
import { SourceList } from "@/components/rag/source-list";

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");

  if (threads.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <FileText className="size-8 text-gray-400" />
          <p className="text-sm text-gray-500 leading-relaxed">
            저장된 소스가 여기에 표시됩니다<br />
            위의 소스 추가를 클릭하여 PDF, <span className="line-through">웹사이트, 텍스트, 동영상 또는 오디오 파일</span>을 추가하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {threads.map((t) => {
        let itemText = t.thread_id;
        if (
          typeof t.values === "object" &&
          t.values &&
          "messages" in t.values &&
          Array.isArray(t.values.messages) &&
          t.values.messages?.length > 0
        ) {
          const firstMessage = t.values.messages[0];
          itemText = getContentString(firstMessage.content);
        }
        return (
          <div
            key={t.thread_id}
            className="w-full px-1"
          >
            <Button
              variant="ghost"
              className="w-[280px] items-start justify-start text-left font-normal"
              onClick={(e) => {
                e.preventDefault();
                onThreadClick?.(t.thread_id);
                if (t.thread_id === threadId) return;
                setThreadId(t.thread_id);
              }}
            >
              <p className="truncate text-ellipsis">{itemText}</p>
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {Array.from({ length: 30 }).map((_, i) => (
        <Skeleton
          key={`skeleton-${i}`}
          className="h-10 w-[280px]"
        />
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, []);

  return (
    <>
      <div className="shadow-inner-right hidden h-screen w-[300px] shrink-0 flex-col items-start justify-start gap-6 border-r-[1px] border-slate-300 lg:flex">
        <div className="flex w-full items-center justify-between px-4 pt-1.5">
          <Button
            className="hover:bg-gray-100"
            variant="ghost"
            onClick={() => setChatHistoryOpen((p) => !p)}
          >
            {chatHistoryOpen ? (
              <PanelRightOpen className="size-5" />
            ) : (
              <PanelRightClose className="size-5" />
            )}
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">
            Knowledge Store
          </h1>
        </div>
        <Separator />
        <div className="w-full px-4 pt-4">
          <Button
            className="w-full rounded-lg"
            variant="default"
            onClick={() => setSourceDialogOpen(true)}
          >
            + 소스추가
          </Button>
          <div className="mt-3 flex w-full items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-blue-600" />
            <p className="text-xs leading-relaxed text-blue-900">
              위의 버튼을 사용해 Knowledge Store에 문서를 추가하세요. 현재는 PDF 파일만 업로드할 수 있습니다.
            </p>
          </div>
        </div>
        <SourceList />
        <div className="flex-1 overflow-hidden">
          {threadsLoading ? (
            <ThreadHistoryLoading />
          ) : (
            <ThreadList threads={threads} />
          )}
        </div>
        <SourceAddDialog
          open={sourceDialogOpen}
          onOpenChange={setSourceDialogOpen}
        />
      </div>
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent
            side="left"
            className="flex flex-col lg:hidden"
          >
            <SheetHeader>
              <SheetTitle>Knowledge Store</SheetTitle>
            </SheetHeader>
            <Separator />
            <div className="w-full px-4 pt-4 pb-4">
              <Button
                className="w-full rounded-lg"
                variant="default"
                onClick={() => setSourceDialogOpen(true)}
              >
                + 소스추가
              </Button>
              <div className="mt-3 flex w-full items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-blue-600" />
                <p className="text-xs leading-relaxed text-blue-900">
                  위의 버튼을 사용해 Knowledge Store에 문서를 추가하세요. 현재는 PDF 파일만 업로드할 수 있습니다.
                </p>
              </div>
            </div>
            <SourceList />
            <div className="flex-1 overflow-hidden">
              <ThreadList
                threads={threads}
                onThreadClick={() => setChatHistoryOpen((o) => !o)}
              />
            </div>
            <SourceAddDialog
              open={sourceDialogOpen}
              onOpenChange={setSourceDialogOpen}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
